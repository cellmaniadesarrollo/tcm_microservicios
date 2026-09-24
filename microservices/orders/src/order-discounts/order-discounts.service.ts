import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
    DiscountStatus,
    DiscountType,
    OrderDiscount,
} from './entities/order-discount.entity';
import { Order } from '../order-workflow/entities/order.entity';
import { CreateOrderDiscountDto } from './dto/create-order-discount.dto';
import { CancelOrderDiscountDto } from './dto/cancel-order-discount.dto';
import { ListOrderDiscountsDto } from './dto/list-order-discounts.dto';

interface RpcUserContext {
    userId: string;
    companyId: string;
    branchId: string;
}

const BLOCKED_STATUSES_FOR_DISCOUNT = [
    'ENTREGADA',
    'PASAR A BODEGA',
    'EN INVENTARIO',
];

@Injectable()
export class OrderDiscountsService {
    constructor(
        @InjectRepository(OrderDiscount)
        private readonly discountRepo: Repository<OrderDiscount>,

        @InjectRepository(Order)
        private readonly orderRepo: Repository<Order>,

        private readonly dataSource: DataSource, // para la transacción
    ) { }

    async create(dto: CreateOrderDiscountDto, user: RpcUserContext) {
        return this.dataSource.transaction(async (manager) => {
            const order = await manager.findOne(Order, {
                where: {
                    id: dto.orderId,
                    company_id: user.companyId,
                    branch_id: user.branchId,
                },
                relations: ['currentStatus'],
            });

            if (!order) {
                throw new RpcException(new NotFoundException('La orden no existe'));
            }

            const statusName = order.currentStatus?.name?.toUpperCase().trim();
            if (BLOCKED_STATUSES_FOR_DISCOUNT.includes(statusName)) {
                throw new RpcException(
                    new BadRequestException(
                        `No se puede aplicar un descuento a una orden en estado "${order.currentStatus.name}"`,
                    ),
                );
            }

            if (
                dto.discountType === DiscountType.PERCENTAGE &&
                dto.discountValue > 100
            ) {
                throw new RpcException(
                    new BadRequestException(
                        'El descuento porcentual no puede ser mayor a 100',
                    ),
                );
            }

            const discount = manager.create(OrderDiscount, {
                order_id: order.id,
                discount_type: dto.discountType,
                discount_value: dto.discountValue,
                reason: dto.reason ?? null,
                status: DiscountStatus.PENDING,
                created_by_id: user.userId,
                company_id: user.companyId,
                branch_id: user.branchId,
            });

            return manager.save(OrderDiscount, discount);
        });
    }
    async cancel(dto: CancelOrderDiscountDto, user: RpcUserContext) {
        return this.dataSource.transaction(async (manager) => {
            const discount = await manager.findOne(OrderDiscount, {
                where: {
                    id: dto.discountId,
                    order_id: dto.orderId,
                    company_id: user.companyId,
                    branch_id: user.branchId,
                },
            });

            if (!discount) {
                throw new RpcException(new NotFoundException('El descuento no existe'));
            }

            if (discount.status === DiscountStatus.CANCELLED) {
                throw new RpcException(
                    new BadRequestException('El descuento ya se encuentra cancelado'),
                );
            }

            if (discount.status === DiscountStatus.APPLIED) {
                throw new RpcException(
                    new BadRequestException(
                        'No se puede cancelar un descuento que ya fue aplicado en el cierre de la orden',
                    ),
                );
            }

            discount.status = DiscountStatus.CANCELLED;
            discount.cancelled_by_id = user.userId;
            discount.cancelled_at = new Date();
            discount.cancelled_reason = dto.cancelledReason ?? null;

            return manager.save(OrderDiscount, discount);
        });
    }

    async list(dto: ListOrderDiscountsDto, user: RpcUserContext) {
        const order = await this.orderRepo.findOne({
            where: {
                id: dto.orderId,
                company_id: user.companyId,
                branch_id: user.branchId,
            },
        });

        if (!order) {
            throw new RpcException(new NotFoundException('La orden no existe'));
        }

        return this.discountRepo.find({
            where: {
                order_id: dto.orderId,
                company_id: user.companyId,
                branch_id: user.branchId,
                ...(dto.status ? { status: dto.status } : {}),
            },
            order: { createdAt: 'DESC' },
        });
    }
}