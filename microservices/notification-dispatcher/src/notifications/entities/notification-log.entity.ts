import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, Index,
} from 'typeorm';

export type NotificationChannel = 'WHATSAPP' | 'EMAIL';
export type NotificationStatus = 'SENT' | 'FAILED';
export type NotificationType = 'ORDER_STATUS_CHANGE' | 'PICKUP_REMINDER';

@Entity('notification_logs')
export class NotificationLog {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Index()
    @Column()
    orderId!: number;

    @Index()
    @Column()
    customerId!: number;

    @Column({ type: 'varchar' })
    type!: NotificationType;

    // Solo para recordatorios: en qué paso de la secuencia estaba
    @Column({ nullable: true })
    sequenceStep?: number;

    @Column({ type: 'varchar' })
    channel!: NotificationChannel;

    @Column()
    recipient!: string; // número o email

    @Column({ type: 'varchar' })
    status!: NotificationStatus;

    @Column({ type: 'text' })
    message!: string;

    @Column({ type: 'text', nullable: true })
    errorMessage?: string;

    @Column({ nullable: true })
    sentAt?: Date;

    @CreateDateColumn()
    createdAt!: Date;
}