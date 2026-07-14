// order-extras.service.ts
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderPendingProduct } from './entities/order-pending-product.entity';
import { Order } from '../order-workflow/entities/order.entity';
import { CreateOrderPendingProductDto } from './dto/create-order-pending-product.dto';
import { UpdateOrderPendingProductDto } from './dto/update-order-pending-product.dto';
import { CreateOrderExtraServiceDto } from './dto/create-order-extra-service.dto';
import { UpdateOrderExtraServiceDto } from './dto/update-order-extra-service.dto';
import { OrderServiceType } from './entities/order-service-type.entity';
import { OrderExtraService } from './entities/order-extra-service.entity';
import { Attachment, AttachmentEntityType } from '../order-findings/entities/attachment.entity';
import { CreateAttachmentDto } from '../order-findings/dto/create-attachment.dto';
import { UpdateAttachmentDto } from '../order-findings/dto/update-attachment.dto';
import { AwsS3Service } from '../aws-s3/aws-s3.service';

type AuthUser = { userId: string; companyId: string };

export type IncomingFile = {
    buffer: string; // base64
    originalname: string;
    mimetype: string;
    size: number;
};

const ATTACHMENT_PREFIX: Partial<Record<AttachmentEntityType, string>> = {
    [AttachmentEntityType.PENDING_PRODUCT]: 'pending-product',
    [AttachmentEntityType.EXTRA_SERVICE]: 'extra-service',
};

@Injectable()
export class OrderExtrasService implements OnModuleInit {
    constructor(
        @InjectRepository(OrderPendingProduct)
        private readonly pendingProductRepo: Repository<OrderPendingProduct>,
        @InjectRepository(OrderExtraService)
        private readonly extraServiceRepo: Repository<OrderExtraService>,
        @InjectRepository(OrderServiceType)
        private readonly serviceTypeRepo: Repository<OrderServiceType>,
        @InjectRepository(Attachment)
        private readonly attachmentRepo: Repository<Attachment>,
        private readonly awsS3Service: AwsS3Service,
    ) { }

    async onModuleInit() {
        await this.seedServiceTypesIfEmpty();
    }

    // ════════════════════════════════════════════════
    // 📦 PENDING PRODUCTS
    // ════════════════════════════════════════════════

    async createPendingProduct(
        dto: CreateOrderPendingProductDto,
        files: IncomingFile[],
        user: AuthUser,
    ) {
        return this.pendingProductRepo.manager.transaction(async (manager) => {
            const order = await this.validateOrderBelongsToCompany(manager, dto.order_id, user.companyId);
            const entity = this.buildPendingProductEntity(dto, order.id, user);
            const saved = await manager.save(entity);

            const attachments = await this.uploadAttachments(
                manager,
                files,
                AttachmentEntityType.PENDING_PRODUCT,
                saved.id,
                user.userId,
            );

            return { ...saved, attachments };
        });
    }

    async updatePendingProduct(
        id: number,
        dto: UpdateOrderPendingProductDto,
        files: IncomingFile[],
        removeAttachmentIds: number[],
        user: AuthUser,
    ) {
        return this.pendingProductRepo.manager.transaction(async (manager) => {
            const existing = await this.findOwnedPendingProduct(manager, id, user.companyId);
            Object.assign(existing, dto);
            const saved = await manager.save(existing);

            await this.removeAttachments(
                manager,
                removeAttachmentIds,
                AttachmentEntityType.PENDING_PRODUCT,
                saved.id,
            );

            const newAttachments = await this.uploadAttachments(
                manager,
                files,
                AttachmentEntityType.PENDING_PRODUCT,
                saved.id,
                user.userId,
            );

            const attachments = await this.getSignedAttachments(
                manager,
                AttachmentEntityType.PENDING_PRODUCT,
                saved.id,
            );

            return { ...saved, attachments, newAttachments };
        });
    }

    async softDeletePendingProduct(id: number, user: AuthUser) {
        return this.pendingProductRepo.manager.transaction(async (manager) => {
            await this.findOwnedPendingProduct(manager, id, user.companyId);
            await manager.softDelete(OrderPendingProduct, id);
            return { id, deleted: true };
        });
    }

    private async findOwnedPendingProduct(
        manager: EntityManager,
        id: number,
        companyId: string,
    ): Promise<OrderPendingProduct> {
        const existing = await manager.findOne(OrderPendingProduct, {
            where: { id, company_id: companyId },
        });

        if (!existing) {
            throw new Error(`Producto pendiente #${id} no encontrado`);
        }

        return existing;
    }

    private buildPendingProductEntity(
        dto: CreateOrderPendingProductDto,
        orderId: number,
        user: AuthUser,
    ): OrderPendingProduct {
        return this.pendingProductRepo.create({
            order_id: orderId,
            company_id: user.companyId,
            name_items: dto.name_items,
            id_brand: dto.id_brand,
            id_model: dto.id_model,
            id_type: dto.id_type,
            id_color: dto.id_color,
            id_quality: dto.id_quality,
            observations: dto.observations,
            sale_price: dto.sale_price,
            quantity: dto.quantity ?? 1,
            created_by_id: user.userId,
        });
    }

    // ════════════════════════════════════════════════
    // 🛠️ EXTRA SERVICES
    // ════════════════════════════════════════════════

    async createExtraService(
        dto: CreateOrderExtraServiceDto,
        files: IncomingFile[],
        user: AuthUser,
    ) {
        return this.extraServiceRepo.manager.transaction(async (manager) => {
            const order = await this.validateOrderBelongsToCompany(manager, dto.order_id, user.companyId);
            const serviceType = await this.validateServiceTypeExists(manager, dto.service_type_id);
            const entity = this.buildExtraServiceEntity(dto, order.id, serviceType.id, user);
            const saved = await manager.save(entity);

            const attachments = await this.uploadAttachments(
                manager,
                files,
                AttachmentEntityType.EXTRA_SERVICE,
                saved.id,
                user.userId,
            );

            return { ...saved, attachments };
        });
    }

    async updateExtraService(
        id: number,
        dto: UpdateOrderExtraServiceDto,
        files: IncomingFile[],
        removeAttachmentIds: number[],
        user: AuthUser,
    ) {
        return this.extraServiceRepo.manager.transaction(async (manager) => {
            const existing = await this.findOwnedExtraService(manager, id, user.companyId);

            if (dto.service_type_id) {
                await this.validateServiceTypeExists(manager, dto.service_type_id);
            }

            Object.assign(existing, {
                service_type_id: dto.service_type_id ?? existing.service_type_id,
                description: dto.description ?? existing.description,
                unit_price: dto.unit_price ?? existing.unit_price,
                quantity: dto.quantity ?? existing.quantity,
            });

            existing.total_price = Number(existing.unit_price) * existing.quantity;

            const saved = await manager.save(existing);

            await this.removeAttachments(
                manager,
                removeAttachmentIds,
                AttachmentEntityType.EXTRA_SERVICE,
                saved.id,
            );

            const newAttachments = await this.uploadAttachments(
                manager,
                files,
                AttachmentEntityType.EXTRA_SERVICE,
                saved.id,
                user.userId,
            );

            const attachments = await this.getSignedAttachments(
                manager,
                AttachmentEntityType.EXTRA_SERVICE,
                saved.id,
            );

            return { ...saved, attachments, newAttachments };
        });
    }

    async softDeleteExtraService(id: number, user: AuthUser) {
        return this.extraServiceRepo.manager.transaction(async (manager) => {
            await this.findOwnedExtraService(manager, id, user.companyId);
            await manager.softDelete(OrderExtraService, id);
            return { id, deleted: true };
        });
    }

    private async validateServiceTypeExists(
        manager: EntityManager,
        serviceTypeId: number,
    ): Promise<OrderServiceType> {
        const serviceType = await manager.findOne(OrderServiceType, {
            where: { id: serviceTypeId, active: true },
        });

        if (!serviceType) {
            throw new Error('El tipo de servicio no existe o está inactivo');
        }

        return serviceType;
    }

    private async findOwnedExtraService(
        manager: EntityManager,
        id: number,
        companyId: string,
    ): Promise<OrderExtraService> {
        const existing = await manager.findOne(OrderExtraService, {
            where: { id, company_id: companyId },
        });

        if (!existing) {
            throw new Error(`Servicio extra #${id} no encontrado`);
        }

        return existing;
    }

    private buildExtraServiceEntity(
        dto: CreateOrderExtraServiceDto,
        orderId: number,
        serviceTypeId: number,
        user: AuthUser,
    ): OrderExtraService {
        const quantity = dto.quantity ?? 1;

        return this.extraServiceRepo.create({
            order_id: orderId,
            company_id: user.companyId,
            service_type_id: serviceTypeId,
            description: dto.description,
            unit_price: dto.unit_price,
            quantity,
            total_price: Number(dto.unit_price) * quantity,
            created_by_id: user.userId,
        });
    }

    // ════════════════════════════════════════════════
    // 📎 ATTACHMENTS — helpers compartidos (pending product / extra service)
    // ════════════════════════════════════════════════

    private async uploadAttachments(
        manager: EntityManager,
        files: IncomingFile[],
        entityType: AttachmentEntityType,
        entityId: number,
        userId: string,
    ): Promise<Attachment[]> {
        if (!files?.length) return [];

        const prefix = `${ATTACHMENT_PREFIX[entityType]}/${entityId}/`;
        const saved: Attachment[] = [];

        for (const file of files) {
            const buffer = Buffer.from(file.buffer, 'base64');
            const key = await this.awsS3Service.uploadBuffer(
                buffer,
                file.originalname,
                file.mimetype,
                prefix,
            );

            const attachment = manager.create(Attachment, {
                entity_type: entityType,
                entity_id: entityId,
                file_name: file.originalname,
                file_url: key,
                file_type: file.mimetype,
                uploaded_by_id: userId,
                is_public: false,
            });

            saved.push(await manager.save(attachment));
        }

        return this.signAttachments(saved);
    }

    private async removeAttachments(
        manager: EntityManager,
        attachmentIds: number[],
        entityType: AttachmentEntityType,
        entityId: number,
    ): Promise<void> {
        if (!attachmentIds?.length) return;

        // 🔒 Solo se pueden borrar attachments que pertenezcan a ESTA entidad puntual,
        // evita que alguien mande un id de otra orden/servicio por error o malicia.
        await manager
            .createQueryBuilder()
            .update(Attachment)
            .set({ is_active: false })
            .where('id IN (:...ids)', { ids: attachmentIds })
            .andWhere('entity_type = :entityType', { entityType })
            .andWhere('entity_id = :entityId', { entityId })
            .execute();
    }

    private async getSignedAttachments(
        manager: EntityManager,
        entityType: AttachmentEntityType,
        entityId: number,
    ): Promise<Attachment[]> {
        const attachments = await manager.find(Attachment, {
            where: { entity_type: entityType, entity_id: entityId, is_active: true },
            order: { createdAt: 'DESC' },
        });

        return this.signAttachments(attachments);
    }

    private async signAttachments(attachments: Attachment[]): Promise<Attachment[]> {
        return Promise.all(
            attachments.map(async (a) => ({
                ...a,
                file_url: await this.awsS3Service.getPresignedUrl(a.file_url),
            })),
        );
    }

    // ════════════════════════════════════════════════
    // 🌱 CATÁLOGO (no multitenant, compartido)
    // ════════════════════════════════════════════════

    private async validateOrderBelongsToCompany(
        manager: EntityManager,
        orderId: number,
        companyId: string,
    ): Promise<Order> {
        const order = await manager.findOne(Order, {
            where: { id: orderId, company_id: companyId },
        });

        if (!order) {
            throw new Error('La orden no existe o no pertenece a la empresa');
        }

        return order;
    }

    async seedServiceTypesIfEmpty(): Promise<void> {
        const count = await this.serviceTypeRepo.count();
        if (count > 0) return;

        const defaultServiceTypes: Array<Pick<OrderServiceType, 'code' | 'name'>> = [
            { code: 'TRANSPORTE_LOCAL', name: 'Transporte local' },
            { code: 'TRANSPORTE_NACIONAL', name: 'Transporte nacional' },
            { code: 'MANO_OBRA_EXTRA', name: 'Mano de obra extra' },
            { code: 'REVISION_ADICIONAL', name: 'Revisión adicional' },
            { code: 'INSTALACION', name: 'Instalación' },
        ];

        const entities = defaultServiceTypes.map((type) =>
            this.serviceTypeRepo.create({ ...type, active: true }),
        );

        await this.serviceTypeRepo.save(entities);
    }

    async listServiceTypes(): Promise<Array<{ id: number; name: string }>> {
        return this.serviceTypeRepo.find({
            where: { active: true },
            select: ['id', 'name'],
            order: { name: 'ASC' },
        });
    }

    private async validateEntityExists(entityType: AttachmentEntityType, entityId: number, companyId: string) {
        switch (entityType) {
            case AttachmentEntityType.EXTRA_SERVICE: {
                const exists = await this.extraServiceRepo.exist({ where: { id: entityId, company_id: companyId } });
                if (!exists) throw new NotFoundException('Servicio extra no encontrado');
                break;
            }
            case AttachmentEntityType.PENDING_PRODUCT: {
                const exists = await this.pendingProductRepo.exist({ where: { id: entityId, company_id: companyId } });
                if (!exists) throw new NotFoundException('Producto pendiente no encontrado');
                break;
            }
            default:
                break;
        }
    }

    async create(dto: CreateAttachmentDto, user: { userId: string; companyId: string }) {
        await this.validateEntityExists(dto.entity_type, dto.entity_id, user.companyId);

        const attachment = this.attachmentRepo.create({
            ...dto,
            uploaded_by_id: user.userId,
            is_public: dto.is_public ?? true,
        });
        return this.attachmentRepo.save(attachment);
    }

    async update(id: number, dto: UpdateAttachmentDto, user: { userId: string; companyId: string }) {
        const attachment = await this.attachmentRepo.findOne({ where: { id, is_active: true } });
        if (!attachment) throw new NotFoundException('Adjunto no encontrado');

        Object.assign(attachment, dto);
        return this.attachmentRepo.save(attachment);
    }

    async softDelete(id: number, user: { userId: string; companyId: string }) {
        const attachment = await this.attachmentRepo.findOne({ where: { id, is_active: true } });
        if (!attachment) throw new NotFoundException('Adjunto no encontrado');

        attachment.is_active = false;
        return this.attachmentRepo.save(attachment);
    }

    async listByEntity(entityType: AttachmentEntityType, entityId: number) {
        const attachments = await this.attachmentRepo.find({
            where: { entity_type: entityType, entity_id: entityId, is_active: true },
            order: { createdAt: 'DESC' },
        });
        return this.signAttachments(attachments);
    }
}