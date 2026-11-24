import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, Index,
} from 'typeorm';

export type NotificationChannel = 'WHATSAPP' | 'EMAIL';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';
export type NotificationType =
    | 'ORDER_STATUS_CHANGE'
    | 'PICKUP_REMINDER'
    | 'REFERRAL_WELCOME'
    | 'BIRTHDAY'
    | 'CUSTOMER_AUTHORIZATION';

@Entity('notification_logs')
export class NotificationLog {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    // Null en notificaciones que no pertenecen a una orden (p. ej. REFERRAL_WELCOME)
    @Index()
    @Column({ type: 'int', nullable: true })
    orderId?: number | null;

    // Antes: customerId!: number. Ahora puede ser null (billing sin cliente vinculado)
    @Index()
    @Column({ type: 'int', nullable: true })
    customerId?: number | null;

    /** Evita envíos duplicados. Ej: birthday:{billingId}:{año} */
    @Index({ unique: true })
    @Column({ type: 'varchar', length: 100, nullable: true })
    dedupeKey?: string | null;

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