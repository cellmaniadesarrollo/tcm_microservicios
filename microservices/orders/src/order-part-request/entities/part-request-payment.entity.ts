// microservices/orders/src/order-part-requests/entities/part-request-payment.entity.ts

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { PartRequest } from './part-request.entity';
import { Attachment } from '../../order-findings/entities/attachment.entity';

@Entity('part_request_payments')
export class PartRequestPayment {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    part_request_id!: number;

    @ManyToOne(() => PartRequest, (pr) => pr.pagos, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'part_request_id' })
    partRequest!: PartRequest;

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
}