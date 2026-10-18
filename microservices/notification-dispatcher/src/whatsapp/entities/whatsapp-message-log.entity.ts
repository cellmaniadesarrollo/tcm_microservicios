import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import type { WhatsappProvider } from './whatsapp-session.entity';

export type WhatsappMessageType = 'TEXT' | 'TEMPLATE' | 'IMAGE' | 'DOCUMENT';
export type WhatsappLogStatus = 'SENT' | 'FAILED';

@Entity('whatsapp_message_logs')
@Index(['companyId', 'createdAt'])
@Index(['waMessageId'])
@Index(['orderId'])
export class WhatsappMessageLog {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    companyId!: string;

    @Column({ type: 'varchar' })
    purpose!: string; // ALL | NOTIFICATIONS | REMINDERS

    /** Por dónde se envió realmente */
    @Column({ type: 'varchar' })
    provider!: WhatsappProvider;

    /** Sin FK a propósito: createSession borra sesiones y no quieres perder el historial */
    @Column({ type: 'varchar', nullable: true })
    sessionId!: string | null;

    /** Número emisor (el de la empresa) */
    @Column({ type: 'varchar', nullable: true })
    fromNumber!: string | null;

    @Column({ type: 'varchar' })
    recipient!: string;

    @Column({ type: 'varchar' })
    messageType!: WhatsappMessageType;

    @Column({ type: 'varchar', nullable: true })
    templateName!: string | null;

    @Column({ type: 'varchar', nullable: true })
    templateEvent!: string | null;

    /** Texto realmente enviado (para plantillas, el body renderizado) */
    @Column({ type: 'text', nullable: true })
    body!: string | null;

    @Column({ type: 'varchar' })
    status!: WhatsappLogStatus;

    /** key.id de Baileys o wamid de Meta */
    @Column({ type: 'varchar', nullable: true })
    waMessageId!: string | null;

    @Column({ type: 'text', nullable: true })
    errorMessage!: string | null;

    /** Si es OFFICIAL→BAILEYS, aquí queda 'OFFICIAL' */
    @Column({ type: 'varchar', nullable: true })
    fallbackFrom!: WhatsappProvider | null;

    @Column({ type: 'int', nullable: true })
    orderId!: number | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;
}