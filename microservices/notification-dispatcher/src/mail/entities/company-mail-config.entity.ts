import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { MailProviderKind, MailPurpose } from '../types/mail.types';

@Entity('company_mail_config')
@Index('uq_mail_config_company_purpose', ['companyId', 'purpose'], { unique: true })
export class CompanyMailConfig {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column('uuid')
    companyId!: string;

    @Column({ type: 'varchar', length: 20, default: 'ALL' })
    purpose!: MailPurpose;

    @Column({ type: 'varchar', length: 10 })
    provider!: MailProviderKind;

    /** Obligatorio para SES y SMTP; GMAIL usa valores por defecto. */
    @Column({ type: 'varchar', length: 150, nullable: true })
    host!: string | null;

    @Column({ type: 'int', nullable: true })
    port!: number | null;

    @Column({ type: 'boolean', nullable: true })
    secure!: boolean | null;

    @Column({ type: 'varchar', length: 200 })
    username!: string;

    /** AES-256-GCM. Nunca se devuelve ni se loguea. */
    @Column({ type: 'text' })
    passwordEncrypted!: string;

    @Column({ type: 'varchar', length: 150 })
    fromEmail!: string;

    @Column({ type: 'varchar', length: 100 })
    fromName!: string;

    @Column({ type: 'varchar', length: 150, nullable: true })
    replyTo!: string | null;

    @Column({ type: 'boolean', default: true })
    isActive!: boolean;

    @Column({ type: 'timestamptz', nullable: true })
    lastVerifiedAt!: Date | null;

    @Column({ type: 'text', nullable: true })
    lastError!: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt!: Date;
}