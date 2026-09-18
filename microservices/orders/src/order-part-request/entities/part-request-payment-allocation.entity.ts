// microservices/orders/src/order-part-requests/entities/part-request-payment-allocation.entity.ts

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Unique,
} from 'typeorm';
import { PartRequestPayment } from './part-request-payment.entity';
import { PartRequest } from './part-request.entity';

@Entity('part_request_payment_allocations')
@Unique(['payment_id', 'part_request_id'])
export class PartRequestPaymentAllocation {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    payment_id!: number;

    @ManyToOne(() => PartRequestPayment, (p) => p.allocations, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'payment_id' })
    payment!: PartRequestPayment;

    @Column()
    part_request_id!: number;

    @ManyToOne(() => PartRequest, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'part_request_id' })
    partRequest!: PartRequest;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    monto_asignado!: number;
}