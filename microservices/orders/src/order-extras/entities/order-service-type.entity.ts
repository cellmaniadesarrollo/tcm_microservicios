// order-extras/entities/order-service-type.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('order_service_types')
export class OrderServiceType {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    code!: string; // 'TRANSPORTE_LOCAL', 'TRANSPORTE_NACIONAL', 'MANO_OBRA_EXTRA'

    @Column()
    name!: string;

    @Column({ default: true })
    active!: boolean;

    @CreateDateColumn()
    createdAt!: Date;
}