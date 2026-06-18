import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderShipping } from './entities/order-shipping.entity';
import { Order } from './entities/order.entity';
import { SaveInboundDto } from './dto/save-inbound.dto';
import { SaveOutboundDto } from './dto/save-outbound.dto';

@Injectable()
export class OrderShippingService {
    constructor(
        @InjectRepository(OrderShipping)
        private readonly shippingRepo: Repository<OrderShipping>,
        @InjectRepository(Order)
        private readonly orderRepo: Repository<Order>,
    ) { }

    // ── Recepción ────────────────────────────────────────────────────────────
    async saveInbound(orderId: number, dto: SaveInboundDto): Promise<OrderShipping> {
        const order = await this.orderRepo.findOne({ where: { id: orderId } });
        if (!order) throw new NotFoundException(`Order ${orderId} not found`);

        let shipping = await this.shippingRepo.findOne({ where: { order_id: orderId } });

        if (shipping) {
            // Ya existe, actualiza solo campos de entrada
            Object.assign(shipping, {
                inbound_tracking: dto.inbound_tracking,
                inbound_courier: dto.inbound_courier,
                inbound_origin_id: dto.inbound_origin_id,
                inbound_sender_address: dto.inbound_sender_address,
                inbound_shipping_cost: dto.inbound_shipping_cost,
                inbound_notes: dto.inbound_notes,
                notes: dto.notes,
            });
        } else {
            shipping = this.shippingRepo.create({ ...dto, order_id: orderId });
        }

        const saved = await this.shippingRepo.save(shipping);

        // Activar flag en la orden
        await this.orderRepo.update(orderId, { is_national: true });

        return saved;
    }

    // ── Retorno ──────────────────────────────────────────────────────────────
    async saveOutbound(orderId: number, dto: SaveOutboundDto): Promise<OrderShipping> {
        const shipping = await this.shippingRepo.findOne({ where: { order_id: orderId } });
        if (!shipping) throw new NotFoundException(`No shipping record for order ${orderId}`);

        Object.assign(shipping, {
            outbound_tracking: dto.outbound_tracking,
            outbound_courier: dto.outbound_courier,
            outbound_dest_id: dto.outbound_dest_id,
            outbound_address: dto.outbound_address,
            outbound_shipping_cost: dto.outbound_shipping_cost,
            outbound_sent_at: dto.outbound_sent_at,
            outbound_notes: dto.outbound_notes,
        });

        return this.shippingRepo.save(shipping);
    }

    // ── Consultar ────────────────────────────────────────────────────────────
    async findByOrder(orderId: number): Promise<OrderShipping> {
        const shipping = await this.shippingRepo.findOne({
            where: { order_id: orderId },
            relations: [
                'inboundOrigin',
                'inboundOrigin.parent',        // cantón
                'inboundOrigin.parent.parent', // provincia
                'outboundDestination',
            ],
        });
        if (!shipping) throw new NotFoundException(`No shipping record for order ${orderId}`);
        return shipping;
    }
}