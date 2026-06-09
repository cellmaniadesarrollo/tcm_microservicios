import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';
import { WhatsappRouting } from './whatsapp-routing.entity';

export type SessionStatus = 'CONNECTED' | 'DISCONNECTED' | 'BANNED';

@Entity('whatsapp_sessions')
export class WhatsappSession {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => CompanyReplica, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'companyId' })
    company!: CompanyReplica;

    @Column()
    companyId!: string;

    // Aquí haces la conexión: una sesión pertenece a un tipo de enrutamiento
    @ManyToOne(() => WhatsappRouting, { onDelete: 'SET NULL', nullable: true, eager: true })
    @JoinColumn({ name: 'routingId' })
    routing!: WhatsappRouting | null;

    @Column({ nullable: true })
    routingId!: string | null; // El ID del tipo de sesión (ALL, NOTIFICATIONS, etc.)

    @Column({ nullable: true })
    phoneNumber!: string;

    @Column({ type: 'jsonb', nullable: true })
    creds: any;

    @Column({ type: 'jsonb', nullable: true })
    keys: any;

    @Column({ default: 'DISCONNECTED' })
    status!: SessionStatus;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}