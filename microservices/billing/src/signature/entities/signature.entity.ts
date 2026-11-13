import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { SignatureBranch } from './signature-branch.entity';

/** Firma electrónica (.p12). El archivo vive en S3 (solo la key); la clave va cifrada y nunca se devuelve. */
@Entity('signatures')
@Index('idx_signatures_company_active', ['companyId', 'active'])
@Index('uq_signatures_company_request', ['companyId', 'clientRequestId'], { unique: true })
export class Signature {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    /** Titular leído del certificado (CN). */
    @Column({ type: 'varchar', length: 255 })
    subject!: string;

    @Column({ name: 'expires_at', type: 'timestamptz' })
    expiresAt!: Date;

    /** Key de S3, nunca una URL. */
    @Column({ name: 'p12_key', type: 'varchar', length: 500 })
    p12Key!: string;

    /** AES-256-GCM, formato iv:tag:data en base64. NUNCA se devuelve al front. */
    @Column({ name: 'password_enc', type: 'text' })
    passwordEnc!: string;

    @Column({ type: 'boolean', default: true })
    active!: boolean;

    @Column({ name: 'client_request_id', type: 'uuid' })
    clientRequestId!: string;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt!: Date;

    @OneToMany(() => SignatureBranch, (sb) => sb.signature)
    branches!: SignatureBranch[];
}