// microservices/orders/src/order-part-requests/entities/part-request-status-history.entity.ts

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { PartRequest } from './part-request.entity';
import { PartRequestStatus } from './enums/part-request-status.enum';

@Entity('part_request_status_history')
export class PartRequestStatusHistory {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    part_request_id!: number;

    @ManyToOne(() => PartRequest, (pr) => pr.historial, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'part_request_id' })
    partRequest!: PartRequest;

    @Column({ type: 'enum', enum: PartRequestStatus, nullable: true })
    estado_anterior?: PartRequestStatus | null;;

    @Column({ type: 'enum', enum: PartRequestStatus })
    estado_nuevo!: PartRequestStatus;

    @Column()
    actor_id!: string;

    @CreateDateColumn()
    fecha!: Date;

    @Column({ nullable: true })
    notas?: string;
}