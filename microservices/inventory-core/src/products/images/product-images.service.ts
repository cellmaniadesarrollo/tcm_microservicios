import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AwsS3Service } from '../../aws-s3/aws-s3.service';
import { Product } from '../entities/product.entity';
import { ProductImage } from '../entities/product-image.entity';

const MAX_IMAGES_PER_PRODUCT = 10;
export interface UploadedKey {
    key: string;
    file: UploadedFilePayload;
}
export interface UploadedFilePayload {
    buffer: string; // base64
    originalname: string;
    mimetype: string;
    size: number;
}

export interface UserCtx {
    userId: string;
    companyId: string;
    branchId?: string;
}

@Injectable()
export class ProductImagesService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly s3: AwsS3Service,
    ) { }

    // ───────────────────────── Subir ─────────────────────────
    async addImages(productId: string, files: UploadedFilePayload[], user: UserCtx) {
        if (!files?.length) throw new BadRequestException('No se envió ninguna imagen');
        await this.assertProduct(this.dataSource.manager, productId, user.companyId);

        const uploaded = await this.uploadFiles(productId, user.companyId, files);
        try {
            const saved = await this.dataSource.transaction(async (em) => {
                await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`product_images:${productId}`]);
                return this.insertImages(em, productId, uploaded, user.userId);
            });
            return this.toResponse(saved);
        } catch (error) {
            await this.cleanup(uploaded.map((u) => u.key));
            throw error;
        }
    }

    // ───────────────────────── Listar ─────────────────────────
    async list(productId: string, companyId: string) {
        await this.assertProduct(this.dataSource.manager, productId, companyId);
        const images = await this.dataSource.getRepository(ProductImage).find({
            where: { productId },
            order: { sortOrder: 'ASC', createdAt: 'ASC' },
        });
        return this.toResponse(images);
    }

    // ───────────────────────── Principal ─────────────────────────
    async setPrimary(productId: string, imageId: string, companyId: string) {
        await this.assertProduct(this.dataSource.manager, productId, companyId);

        await this.dataSource.transaction(async (em) => {
            await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`product_images:${productId}`]);

            const image = await em.findOne(ProductImage, { where: { id: imageId, productId } });
            if (!image) throw new NotFoundException('Imagen no encontrada');
            if (image.isPrimary) return;

            // Primero quitar la anterior (el índice único parcial no permite dos a la vez)
            await em.update(ProductImage, { productId, isPrimary: true }, { isPrimary: false });
            await em.update(ProductImage, { id: imageId }, { isPrimary: true });
        });

        return this.list(productId, companyId);
    }

    // ───────────────────────── Ordenar ─────────────────────────
    async reorder(productId: string, imageIds: string[], companyId: string) {
        await this.assertProduct(this.dataSource.manager, productId, companyId);

        await this.dataSource.transaction(async (em) => {
            await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`product_images:${productId}`]);

            const current = await em.find(ProductImage, { where: { productId }, select: { id: true } });
            const currentIds = new Set(current.map((i) => i.id));
            const incoming = new Set(imageIds);

            if (incoming.size !== imageIds.length || incoming.size !== currentIds.size
                || ![...incoming].every((id) => currentIds.has(id))) {
                throw new BadRequestException('La lista debe contener exactamente todas las imágenes del producto');
            }

            for (let i = 0; i < imageIds.length; i++) {
                await em.update(ProductImage, { id: imageIds[i] }, { sortOrder: i });
            }
        });

        return this.list(productId, companyId);
    }

    // ───────────────────────── Eliminar ─────────────────────────
    async remove(productId: string, imageId: string, companyId: string) {
        await this.assertProduct(this.dataSource.manager, productId, companyId);

        const fileKey = await this.dataSource.transaction(async (em) => {
            await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`product_images:${productId}`]);

            const image = await em.findOne(ProductImage, { where: { id: imageId, productId } });
            if (!image) throw new NotFoundException('Imagen no encontrada');

            await em.remove(image);

            // Si era la principal, promovemos la siguiente
            if (image.isPrimary) {
                const next = await em.findOne(ProductImage, {
                    where: { productId },
                    order: { sortOrder: 'ASC', createdAt: 'ASC' },
                });
                if (next) await em.update(ProductImage, { id: next.id }, { isPrimary: true });
            }
            return image.fileKey;
        });

        // Fuera de la transacción: si S3 falla, la BD ya quedó consistente
        await this.s3.deleteObject(fileKey);
        return this.list(productId, companyId);
    }

    // ───────────────────────── Helpers ─────────────────────────
    private async assertProduct(em: EntityManager, productId: string, companyId: string) {
        const ok = await em.exists(Product, { where: { id: productId, companyId } });
        if (!ok) throw new NotFoundException('Producto no encontrado');
    }

    /** Evita espacios y caracteres raros en la key de S3. */
    private safeName(name: string): string {
        return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    }

    /** Firma cada key al leer; nunca se expone la key ni una URL permanente. */
    private async toResponse(images: ProductImage[]) {
        return Promise.all(
            images.map(async (img) => ({
                id: img.id,
                url: await this.s3.getPresignedUrl(img.fileKey),
                fileName: img.fileName,
                mimeType: img.mimeType,
                sizeBytes: img.sizeBytes,
                sortOrder: img.sortOrder,
                isPrimary: img.isPrimary,
                createdAt: img.createdAt,
            })),
        );
    }



    // ───────── dentro de la clase ProductImagesService ─────────

    /** Valida y sube a S3. Devuelve las keys para registrarlas en BD. */
    async uploadFiles(productId: string, companyId: string, files: UploadedFilePayload[]): Promise<UploadedKey[]> {
        if (!files.length) return [];
        if (files.length > MAX_IMAGES_PER_PRODUCT) {
            throw new BadRequestException(`Un producto admite máximo ${MAX_IMAGES_PER_PRODUCT} imágenes`);
        }
        if (files.some((f) => !f.mimetype?.startsWith('image/'))) {
            throw new BadRequestException('Solo se permiten imágenes');
        }

        const prefix = `companies/${companyId}/products/${productId}/`;
        const uploaded: UploadedKey[] = [];
        try {
            for (const file of files) {
                const key = await this.s3.uploadBuffer(
                    Buffer.from(file.buffer, 'base64'),
                    this.safeName(file.originalname),
                    file.mimetype,
                    prefix,
                );
                uploaded.push({ key, file });
            }
            return uploaded;
        } catch (error) {
            await this.cleanup(uploaded.map((u) => u.key));
            throw error;
        }
    }

    /** Registra las imágenes dentro de una transacción ya abierta. */
    async insertImages(em: EntityManager, productId: string, uploaded: UploadedKey[], userId: string) {
        if (!uploaded.length) return [];

        const count = await em.countBy(ProductImage, { productId });
        if (count + uploaded.length > MAX_IMAGES_PER_PRODUCT) {
            throw new BadRequestException(`Un producto admite máximo ${MAX_IMAGES_PER_PRODUCT} imágenes`);
        }

        const row = await em
            .createQueryBuilder(ProductImage, 'i')
            .select('COALESCE(MAX(i.sortOrder), -1)', 'max')
            .where('i.productId = :productId', { productId })
            .getRawOne<{ max: string | number }>();
        let sortOrder = Number(row?.max ?? -1);
        let needsPrimary = !(await em.exists(ProductImage, { where: { productId, isPrimary: true } }));

        const entities = uploaded.map(({ key, file }) => {
            sortOrder += 1;
            const isPrimary = needsPrimary;
            needsPrimary = false;
            return em.create(ProductImage, {
                productId,
                fileKey: key,
                fileName: file.originalname,
                mimeType: file.mimetype,
                sizeBytes: file.size,
                sortOrder,
                isPrimary,
                uploadedById: userId,
            });
        });
        return em.save(entities);
    }

    async cleanup(keys: string[]) {
        await Promise.all(keys.map((k) => this.s3.deleteObject(k)));
    }
}