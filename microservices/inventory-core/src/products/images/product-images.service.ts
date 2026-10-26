import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { DataSource, EntityManager, In } from 'typeorm';
import { AwsS3Service } from '../../aws-s3/aws-s3.service';
import { Product } from '../entities/product.entity';
import { ProductImage } from '../entities/product-image.entity';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction } from '../../audit-log/enums/audit-action.enum';
// Ajusta estas rutas a donde tengas el módulo de auditoría


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
        private readonly audit: AuditLogService,
    ) { }

    // ───────────────────────── Subir ─────────────────────────
    async addImages(productId: string, files: UploadedFilePayload[], user: UserCtx) {
        if (!files?.length) {
            throw new RpcException(
                new BadRequestException('No se envió ninguna imagen'),
            );
        }
        await this.assertProduct(this.dataSource.manager, productId, user.companyId);

        const uploaded = await this.uploadFiles(productId, user.companyId, files);
        try {
            const saved = await this.dataSource.transaction(async (em) => {
                await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`product_images:${productId}`]);
                const rows = await this.insertImages(em, productId, uploaded, user.userId);

                await this.audit.log(em, {
                    companyId: user.companyId,
                    entity: Product,
                    entityId: productId,
                    action: AuditAction.UPDATED,
                    userId: user.userId,
                    changes: { imagesAdded: { to: rows.map((r) => this.imageRef(r)) } },
                });
                return rows;
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
    async setPrimary(productId: string, imageId: string, user: UserCtx) {
        await this.assertProduct(this.dataSource.manager, productId, user.companyId);

        await this.dataSource.transaction(async (em) => {
            await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`product_images:${productId}`]);

            const image = await em.findOne(ProductImage, { where: { id: imageId, productId } });
            if (!image) {
                throw new RpcException(
                    new NotFoundException('Imagen no encontrada'),
                );
            }
            if (image.isPrimary) return;

            const previous = await em.findOne(ProductImage, { where: { productId, isPrimary: true } });

            // Primero quitar la anterior (el índice único parcial no permite dos a la vez)
            await em.update(ProductImage, { productId, isPrimary: true }, { isPrimary: false });
            await em.update(ProductImage, { id: imageId }, { isPrimary: true });

            await this.audit.log(em, {
                companyId: user.companyId,
                entity: Product,
                entityId: productId,
                action: AuditAction.UPDATED,
                userId: user.userId,
                changes: { primaryImage: { from: previous ? this.imageRef(previous) : null, to: this.imageRef(image) } },
            });
        });

        return this.list(productId, user.companyId);
    }

    // ───────────────────────── Ordenar ─────────────────────────
    async reorder(productId: string, imageIds: string[], user: UserCtx) {
        await this.assertProduct(this.dataSource.manager, productId, user.companyId);

        await this.dataSource.transaction(async (em) => {
            await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`product_images:${productId}`]);

            const current = await em.find(ProductImage, {
                where: { productId },
                select: { id: true },
                order: { sortOrder: 'ASC', createdAt: 'ASC' },
            });
            const previousOrder = current.map((i) => i.id);
            const currentIds = new Set(previousOrder);
            const incoming = new Set(imageIds);

            if (incoming.size !== imageIds.length || incoming.size !== currentIds.size
                || ![...incoming].every((id) => currentIds.has(id))) {
                throw new RpcException(
                    new BadRequestException('La lista debe contener exactamente todas las imágenes del producto'),
                );
            }

            for (let i = 0; i < imageIds.length; i++) {
                await em.update(ProductImage, { id: imageIds[i] }, { sortOrder: i });
            }

            // Solo se audita si el orden realmente cambió
            if (previousOrder.some((id, idx) => id !== imageIds[idx])) {
                await this.audit.log(em, {
                    companyId: user.companyId,
                    entity: Product,
                    entityId: productId,
                    action: AuditAction.UPDATED,
                    userId: user.userId,
                    changes: { imagesOrder: { from: previousOrder, to: imageIds } },
                });
            }
        });

        return this.list(productId, user.companyId);
    }

    // ───────────────────────── Eliminar ─────────────────────────
    async remove(productId: string, imageId: string, user: UserCtx) {
        await this.assertProduct(this.dataSource.manager, productId, user.companyId);

        const fileKey = await this.dataSource.transaction(async (em) => {
            await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`product_images:${productId}`]);

            const image = await em.findOne(ProductImage, { where: { id: imageId, productId } });
            if (!image) {
                throw new RpcException(
                    new NotFoundException('Imagen no encontrada'),
                );
            }

            // Se copian antes del remove: TypeORM deja el id del objeto en undefined al borrarlo
            const removed = this.imageRef(image);
            const wasPrimary = image.isPrimary;
            const key = image.fileKey;

            await em.remove(image);

            // Si era la principal, promovemos la siguiente
            let promoted: ProductImage | null = null;
            if (wasPrimary) {
                const next = await em.findOne(ProductImage, {
                    where: { productId },
                    order: { sortOrder: 'ASC', createdAt: 'ASC' },
                });
                if (next) {
                    await em.update(ProductImage, { id: next.id }, { isPrimary: true });
                    promoted = next;
                }
            }

            await this.audit.log(em, {
                companyId: user.companyId,
                entity: Product,
                entityId: productId,
                action: AuditAction.UPDATED,
                userId: user.userId,
                changes: {
                    imagesRemoved: { from: removed },
                    ...(promoted ? { primaryImage: { from: removed, to: this.imageRef(promoted) } } : {}),
                },
            });
            return key;
        });

        // Fuera de la transacción: si S3 falla, la BD ya quedó consistente
        await this.s3.deleteObject(fileKey);
        return this.list(productId, user.companyId);
    }

    // ───────────────────────── Helpers ─────────────────────────
    private async assertProduct(em: EntityManager, productId: string, companyId: string) {
        const ok = await em.exists(Product, { where: { id: productId, companyId } });
        if (!ok) {
            throw new RpcException(
                new NotFoundException('Producto no encontrado'),
            );
        }
    }

    /** Referencia corta de una imagen para la bitácora. */
    private imageRef(i: ProductImage) {
        return { id: i.id, fileName: i.fileName };
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

    /** Valida y sube a S3. Devuelve las keys para registrarlas en BD. */
    async uploadFiles(productId: string, companyId: string, files: UploadedFilePayload[]): Promise<UploadedKey[]> {
        if (!files.length) return [];
        if (files.length > MAX_IMAGES_PER_PRODUCT) {
            throw new RpcException(
                new BadRequestException(`Un producto admite máximo ${MAX_IMAGES_PER_PRODUCT} imágenes`),
            );
        }
        if (files.some((f) => !f.mimetype?.startsWith('image/'))) {
            throw new RpcException(
                new BadRequestException('Solo se permiten imágenes'),
            );
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
            throw new RpcException(
                new BadRequestException(`Un producto admite máximo ${MAX_IMAGES_PER_PRODUCT} imágenes`),
            );
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

    /** URL firmada de la imagen principal de varios productos a la vez. */
    async primaryImageUrls(productIds: string[]): Promise<Map<string, string>> {
        if (!productIds.length) return new Map();
        const images = await this.dataSource.getRepository(ProductImage).find({
            where: { productId: In(productIds), isPrimary: true },
            select: { productId: true, fileKey: true },
        });
        const entries = await Promise.all(
            images.map(async (i) => [i.productId, await this.s3.getPresignedUrl(i.fileKey)] as const),
        );
        return new Map(entries);
    }
}