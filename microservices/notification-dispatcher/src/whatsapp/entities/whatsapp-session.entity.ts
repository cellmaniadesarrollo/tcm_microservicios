import {
    Entity, PrimaryGeneratedColumn, Column,
    OneToOne, JoinColumn, UpdateDateColumn, CreateDateColumn,
} from 'typeorm';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';

@Entity('whatsapp_sessions')
export class WhatsappSession {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @OneToOne(() => CompanyReplica, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'companyId' })
    company!: CompanyReplica;

    @Column()
    companyId!: string;

    @Column({ nullable: true })
    phoneNumber!: string;

    /** Credenciales principales de Baileys (se actualizan poco) */
    @Column({ type: 'jsonb', nullable: true })
    creds: any;

    /** Signal keys (se actualizan frecuentemente) */
    @Column({ type: 'jsonb', nullable: true })
    keys: any;

    @Column({ default: 'DISCONNECTED' }) // CONNECTED | DISCONNECTED | BANNED
    status!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}