// microservices/orders/src/order-part-requests/entities/part-request-sourcing.entity.ts

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    OneToMany,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { PartRequest } from './part-request.entity';
import { Provider } from './provider.entity'; // NUEVO
import { SourcingProviderAccount } from './sourcing-provider-account.entity'; // NUEVO

@Entity('part_request_sourcing')
export class PartRequestSourcing {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    part_request_id!: number;

    @OneToOne(() => PartRequest, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'part_request_id' })
    partRequest!: PartRequest;

    // CAMBIO: "proveedor" (texto libre) → provider_id (FK)
    @Column({ nullable: true })
    provider_id?: number;

    @ManyToOne(() => Provider, { nullable: true })
    @JoinColumn({ name: 'provider_id' })
    provider?: Provider;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    precio?: number;

    @Column({ type: 'int', default: 1 })
    cantidad!: number;

    @Column({ nullable: true })
    contacto_proveedor?: string;

    @Column({ nullable: true })
    link_compra?: string;

    @Column({ type: 'text', nullable: true })
    notas?: string;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, default: 0 })
    precio_transporte?: number;

    // CAMBIO: se eliminan banco / numero_cuenta / tipo_cuenta / titular_cuenta
    // (ahora viven en ProviderAccount, referenciadas vía el pivote de abajo)

    @OneToMany(() => SourcingProviderAccount, (s) => s.sourcing, { cascade: true }) // NUEVO
    cuentasSeleccionadas!: SourcingProviderAccount[];

    @Column({ type: 'uuid' })
    registrado_por_id!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}