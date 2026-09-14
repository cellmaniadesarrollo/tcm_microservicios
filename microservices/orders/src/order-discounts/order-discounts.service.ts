import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { IsNull, Repository } from 'typeorm';
import { DiscountType, OrderDiscount } from './entities/order-discount.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from '../order-workflow/entities/order.entity';

@Injectable()
export class OrderDiscountsService {
    constructor(
        @InjectRepository(OrderDiscount)
        private readonly orderDiscountRepo: Repository<OrderDiscount>,
        @InjectRepository(Order)
        private readonly orderRepo: Repository<Order>,
    ) { }

    async registrarDescuento(
        orderId: number,
        body: { tipo: DiscountType; valor: number; motivo: string },
        user: { userId: string; username?: string; companyId: string },
    ) {
        const order = await this.orderRepo.findOne({
            where: { id: orderId, company_id: user.companyId },
            select: ['id', 'order_number'],
        });

        if (!order) {
            throw new RpcException(new NotFoundException('Orden no encontrada'));
        }

        if (!body.tipo || !Object.values(DiscountType).includes(body.tipo)) {
            throw new RpcException(new BadRequestException('Tipo de descuento inválido, debe ser PORCENTAJE o FIJO'));
        }

        if (body.valor == null || body.valor <= 0) {
            throw new RpcException(new BadRequestException('El valor del descuento debe ser mayor a 0'));
        }

        if (body.tipo === DiscountType.PORCENTAJE && body.valor > 100) {
            throw new RpcException(new BadRequestException('El porcentaje no puede ser mayor a 100'));
        }

        if (!body.motivo?.trim()) {
            throw new RpcException(new BadRequestException('El motivo del descuento es obligatorio'));
        }

        const descuento = this.orderDiscountRepo.create({
            order_id: order.id,
            tipo: body.tipo,
            valor: body.valor,
            motivo: body.motivo.trim(),
            registrado_por_id: user.userId,
            registrado_por_nombre: user.username,
        });

        return this.orderDiscountRepo.save(descuento);
    }

    async getDescuentos(orderId: number, user: { companyId: string }) {
        const order = await this.orderRepo.findOne({
            where: { id: orderId, company_id: user.companyId },
            select: ['id'],
        });

        if (!order) {
            throw new RpcException(new NotFoundException('Orden no encontrada'));
        }

        return this.orderDiscountRepo.find({
            where: { order_id: orderId, deletedAt: IsNull() },
            order: { createdAt: 'DESC' },
        });
    }

    async eliminarDescuento(
        discountId: number,
        user: { userId: string; username?: string; companyId: string },
    ) {
        const descuento = await this.orderDiscountRepo.findOne({
            where: { id: discountId, deletedAt: IsNull() },
            relations: ['order'],
        });

        if (!descuento) {
            throw new RpcException(new NotFoundException('Descuento no encontrado'));
        }

        if (descuento.order.company_id !== user.companyId) {
            throw new RpcException(new ForbiddenException('No tienes acceso a este descuento'));
        }

        descuento.deletedAt = new Date();
        descuento.deletedPorId = user.userId;
        descuento.deletedPorNombre = user.username || null;

        await this.orderDiscountRepo.save(descuento);

        return { success: true, discountId };
    }
}
