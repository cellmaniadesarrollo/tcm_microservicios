import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
    JoinColumn, CreateDateColumn, UpdateDateColumn, Index
} from 'typeorm';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';
import { WhatsappRouting } from './whatsapp-routing.entity';
import { WhatsappTemplate } from './whatsapp-template.entity';

export type SessionStatus = 'CONNECTED' | 'IDLE' | 'DISCONNECTED' | 'BANNED';
export type WhatsappProvider = 'BAILEYS' | 'OFFICIAL';

@Entity('whatsapp_sessions')
export class WhatsappSession {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => CompanyReplica, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'companyId' })
    company!: CompanyReplica;

    @Column()
    companyId!: string;

    @ManyToOne(() => WhatsappRouting, { onDelete: 'SET NULL', nullable: true, eager: true })
    @JoinColumn({ name: 'routingId' })
    routing!: WhatsappRouting | null;

    @Column({ type: 'varchar', nullable: true })
    routingId!: string | null;

    @Column({ type: 'varchar', default: 'BAILEYS' })
    provider!: WhatsappProvider;

    @Column({ nullable: true })
    phoneNumber!: string;

    // ─── Baileys (no oficial) ──────────────────────────────────────────────────

    @Column({ type: 'jsonb', nullable: true })
    creds: any;

    @Column({ type: 'jsonb', nullable: true })
    keys: any;

    // ─── API Oficial (Meta Cloud API) ──────────────────────────────────────────

    @Column({ type: 'varchar', nullable: true })
    accessToken!: string | null;

    @Column({ type: 'varchar', nullable: true })
    @Index() // se busca seguido al recibir webhooks de Meta
    phoneNumberId!: string | null;

    @Column({ type: 'varchar', nullable: true })
    wabaId!: string | null;

    @Column({ type: 'varchar', nullable: true, default: 'v20.0' })
    apiVersion!: string | null;

    @Column({ default: 'DISCONNECTED' })
    status!: SessionStatus;

    // Relación inversa: plantillas registradas para esta sesión oficial
    @OneToMany(() => WhatsappTemplate, (template) => template.session)
    templates!: WhatsappTemplate[];

    // ─── Auditoría ────────────────────────────────────────────────────────────

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'timestamptz', nullable: true })
    lastUsedAt!: Date | null;
}