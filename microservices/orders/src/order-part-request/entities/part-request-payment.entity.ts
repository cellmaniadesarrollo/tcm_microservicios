// microservices/orders/src/order-part-requests/entities/part-request-payment.entity.ts

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { Provider } from './provider.entity';
import { PartRequestPaymentAllocation } from './part-request-payment-allocation.entity';
import { Attachment } from '../../order-findings/entities/attachment.entity';

@Entity('part_request_payments')
export class PartRequestPayment {
    @PrimaryGeneratedColumn()
    id!: number;

    // FIX: Se agrega nullable: true a la columna y el modificador '?' de TS
    @Column({ nullable: true })
    provider_id?: number;

    // FIX: Se especifica { nullable: true } en la relación
    @ManyToOne(() => Provider, { eager: true, nullable: true })
    @JoinColumn({ name: 'provider_id' })
    provider?: Provider;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    monto!: number;

    @Column({ type: 'timestamp' })
    fecha_pago!: Date;

    @Column()
    registrado_por_id!: string;

    @Column({ nullable: true })
    comprobante_adjunto_id?: number;

    @ManyToOne(() => Attachment, { nullable: true })
    @JoinColumn({ name: 'comprobante_adjunto_id' })
    comprobanteAdjunto?: Attachment;

    @Column({ nullable: true })
    notas?: string;

    @OneToMany(() => PartRequestPaymentAllocation, (a) => a.payment, { cascade: true })
    allocations!: PartRequestPaymentAllocation[];

    @CreateDateColumn()
    createdAt!: Date;
}