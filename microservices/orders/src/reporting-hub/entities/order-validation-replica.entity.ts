// src/reporting-hub-events/entities/order-validation-replica.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

@Entity('order_validation_replicas')
export class OrderValidationReplica {

    @PrimaryGeneratedColumn()
    id!: number;

    @Index({ unique: true })
    @Column({ type: 'int' })
    order_id!: number;

    @Column({ default: false })
    is_checked!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}