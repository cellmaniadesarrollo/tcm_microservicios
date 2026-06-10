import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type MessagePurpose = 'ALL' | 'NOTIFICATIONS' | 'REMINDERS' | 'SUPPORT';

@Entity('whatsapp_routing')
export class WhatsappRouting {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ unique: true }) // 'ALL', 'NOTIFICATIONS', 'REMINDERS'
    name!: string;

    @Column({ type: 'varchar' })
    purpose!: MessagePurpose;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}