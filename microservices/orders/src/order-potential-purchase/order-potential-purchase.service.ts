// order-potential-purchase/order-potential-purchase.service.ts
import {
    Injectable,
    NotFoundException,
    ConflictException,
    UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderPotentialPurchase } from './entities/order-potential-purchase.entity';
import { CreateOrderPotentialPurchaseDto } from './dto/create-order-potential-purchase.dto';
import { Order } from '../order-workflow/entities/order.entity';

@Injectable()
export class OrderPotentialPurchaseService {
    constructor(
        @InjectRepository(OrderPotentialPurchase)
        private readonly repo: Repository<OrderPotentialPurchase>,

        @InjectRepository(Order)
        private readonly orderRepo: Repository<Order>,
    ) { }

    async markAsPotential(dto: CreateOrderPotentialPurchaseDto) {
        if (dto.internalToken !== process.env.INTERNAL_SECRET) {
            throw new UnauthorizedException('Token interno inválido');
        }

        // Verificar que la orden existe y pertenece a la misma empresa del user
        const order = await this.orderRepo.findOne({
            where: {
                id: dto.order_id,
                company_id: dto.user.companyId,
            },
        });

        if (!order) {
            throw new NotFoundException(`Orden #${dto.order_id} no encontrada`);
        }

        // Verificar si ya está marcada
        const existing = await this.repo.findOne({
            where: { order_id: dto.order_id },
        });

        if (existing) {
            throw new ConflictException(
                `La orden #${dto.order_id} ya está marcada como potencial compra`,
            );
        }

        const record = this.repo.create({
            order_id: dto.order_id,
            marked_by_id: dto.user.userId,
            observations: dto.observations,
            is_potential: true,
        });

        return this.repo.save(record);
    }

    async unmarkAsPotential(order_id: number, user: { userId: string; companyId: string }, internalToken: string) {
        if (internalToken !== process.env.INTERNAL_SECRET) {
            throw new UnauthorizedException('Token interno inválido');
        }

        const record = await this.repo.findOne({
            where: { order_id },
        });

        if (!record) {
            throw new NotFoundException(
                `No existe marca de potencial compra para la orden #${order_id}`,
            );
        }

        await this.repo.remove(record);
        return { message: `Marca de potencial compra eliminada para orden #${order_id}` };
    }

    async getByOrderId(order_id: number) {
        return this.repo.findOne({
            where: { order_id },
            relations: ['markedBy'],
        });
    }
}