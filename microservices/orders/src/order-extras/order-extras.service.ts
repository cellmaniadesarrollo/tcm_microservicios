// order-extras.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
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
type AuthUser = { userId: string; companyId: string };
@Injectable()
export class OrderExtrasService implements OnModuleInit {
    constructor(
        @InjectRepository(OrderPendingProduct)
        private readonly pendingProductRepo: Repository<OrderPendingProduct>,
        @InjectRepository(OrderExtraService)
        private readonly extraServiceRepo: Repository<OrderExtraService>,
        @InjectRepository(OrderServiceType)
        private readonly serviceTypeRepo: Repository<OrderServiceType>,
    ) { }
    async onModuleInit() {
        console.log('¡El módulo se está iniciando!'); // Agrega este log para testear
        await this.seedServiceTypesIfEmpty();
    }
    // ════════════════════════════════════════════════
    // 📦 PENDING PRODUCTS
    // ════════════════════════════════════════════════

    async createPendingProduct(dto: CreateOrderPendingProductDto, user: AuthUser) {
        return this.pendingProductRepo.manager.transaction(async (manager) => {
            const order = await this.validateOrderBelongsToCompany(manager, dto.order_id, user.companyId);
            const entity = this.buildPendingProductEntity(dto, order.id, user);
            return manager.save(entity);
        });
    }

    async updatePendingProduct(id: number, dto: UpdateOrderPendingProductDto, user: AuthUser) {
        return this.pendingProductRepo.manager.transaction(async (manager) => {
            const existing = await this.findOwnedPendingProduct(manager, id, user.companyId);
            Object.assign(existing, dto);
            return manager.save(existing);
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

    async createExtraService(dto: CreateOrderExtraServiceDto, user: AuthUser) {
        return this.extraServiceRepo.manager.transaction(async (manager) => {
            const order = await this.validateOrderBelongsToCompany(manager, dto.order_id, user.companyId);
            const serviceType = await this.validateServiceTypeExists(manager, dto.service_type_id);
            const entity = this.buildExtraServiceEntity(dto, order.id, serviceType.id, user);
            return manager.save(entity);
        });
    }

    async updateExtraService(id: number, dto: UpdateOrderExtraServiceDto, user: AuthUser) {
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

            return manager.save(existing);
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
        console.log(`✅ Seed de order_service_types completado (${entities.length} registros)`);
    }

    async listServiceTypes(): Promise<Array<{ id: number; name: string }>> {
        return this.serviceTypeRepo.find({
            where: { active: true },
            select: ['id', 'name'],
            order: { name: 'ASC' },
        });
    }
}