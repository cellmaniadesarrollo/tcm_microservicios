import {
    Entity, PrimaryGeneratedColumn, Column,
    OneToOne, JoinColumn, ManyToOne,
    CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { GeoDivision } from '../../catalogs/entities/geo-division.entity';

@Entity('order_shipping')
export class OrderShipping {
    @PrimaryGeneratedColumn()
    id!: number;

    @OneToOne(() => Order, (o) => o.shipping)
    @JoinColumn({ name: 'order_id' })
    order!: Order;

    @Column({ unique: true })
    order_id!: number;

    // ── Entrada (cliente envía el equipo) ──────────────────
    @Column({ length: 100, nullable: true })
    inbound_tracking?: string;           // número de guía

    @Column({ length: 100, nullable: true })
    inbound_courier?: string;            // "Servientrega", "DHL"...

    @ManyToOne(() => GeoDivision, { eager: true, nullable: true })
    @JoinColumn({ name: 'inbound_origin_id' })
    inboundOrigin?: GeoDivision;         // cantón/parroquia de origen

    @Column({ nullable: true })
    inbound_origin_id?: number;

    @Column({ type: 'text', nullable: true })
    inbound_sender_address?: string;     // dirección exacta del remitente

    @Column({ type: 'timestamp', nullable: true })
    inbound_received_at?: Date;          // cuándo llegó físicamente

    @Column({ type: 'text', nullable: true })
    inbound_notes?: string;              // observaciones de entrada
    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    inbound_shipping_cost?: number;      // lo que cobró el courier al enviar
    // ── Retorno (se devuelve el equipo reparado) ───────────
    @Column({ length: 100, nullable: true })
    outbound_tracking?: string;

    @Column({ length: 100, nullable: true })
    outbound_courier?: string;

    @ManyToOne(() => GeoDivision, { eager: true, nullable: true })
    @JoinColumn({ name: 'outbound_dest_id' })
    outboundDestination?: GeoDivision;

    @Column({ nullable: true })
    outbound_dest_id?: number;

    @Column({ type: 'text', nullable: true })
    outbound_address?: string;           // dirección exacta de devolución

    @Column({ type: 'timestamp', nullable: true })
    outbound_sent_at?: Date;

    @Column({ type: 'text', nullable: true })
    outbound_notes?: string;             // observaciones de retorno
    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    outbound_shipping_cost?: number;     // lo que costará devolver el equipo
    // ── General ────────────────────────────────────────────
    @Column({ type: 'text', nullable: true })
    notes?: string;                      // observaciones generales del envío

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}