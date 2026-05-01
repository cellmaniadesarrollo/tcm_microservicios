import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export type ScheduleStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

@Entity('notification_schedules')
export class NotificationSchedule {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Index({ unique: true }) // solo una secuencia activa por orden
    @Column()
    orderId!: number;

    @Column()
    customerId!: number;

    // Para saber cuándo inició y calcular el límite de 3 meses
    @Column()
    startedAt!: Date;

    @Column({ default: 0 })
    currentStep!: number; // 0→1d, 1→2d, 2→4d, 3→8d, 4→16d, 5→32d ...

    @Index()
    @Column()
    nextSendAt!: Date;

    @Column({ type: 'varchar', default: 'ACTIVE' })
    status!: ScheduleStatus;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}