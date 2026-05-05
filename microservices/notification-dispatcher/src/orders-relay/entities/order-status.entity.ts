// src/orders-relay/entities/order-status.entity.ts

import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('order_statuses')
export class OrderStatus {
    @PrimaryColumn({ name: 'id' })
    id!: number;

    @Column()
    name!: string;

    @Column({ nullable: true })
    color?: string;
} 