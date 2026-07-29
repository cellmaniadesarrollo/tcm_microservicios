// src/orders-relay/entities/order-type.entity.ts

import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('order_types')
export class OrderType {
    @PrimaryColumn({ name: 'id' })
    id!: number;

    @Column()
    name!: string;

    @Column({ nullable: true })
    description?: string;
}