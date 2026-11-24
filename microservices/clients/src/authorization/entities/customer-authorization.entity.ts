import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum AuthorizationStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    USED = 'USED',
    EXPIRED = 'EXPIRED',
    REJECTED = 'REJECTED',
}

@Entity('customer_authorization')
// Una sola autorización activa por usuario (garantizado por la BD)
@Index('uq_active_authorization_per_user', ['requestedByUserId'], {
    unique: true,
    where: `"status" IN ('PENDING','APPROVED')`,
})
export class CustomerAuthorization {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Index()
    @Column({ name: 'company_id' })
    companyId!: string;

    @Column({ name: 'requested_by_user_id' })
    requestedByUserId!: string;

    @Column({ name: 'requested_by_username', type: 'varchar', nullable: true })
    requestedByUsername!: string | null;

    // Solo el hash, nunca el token en claro
    @Index({ unique: true })
    @Column({ name: 'token_hash', length: 64 })
    tokenHash!: string;

    @Column({ type: 'enum', enum: AuthorizationStatus, default: AuthorizationStatus.PENDING })
    status!: AuthorizationStatus;

    // Límite para APROBAR
    @Column({ name: 'expires_at', type: 'timestamptz' })
    expiresAt!: Date;

    // Límite para USAR la autorización (se fija al aprobar)
    @Column({ name: 'usable_until', type: 'timestamptz', nullable: true })
    usableUntil!: Date | null;

    @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
    approvedAt!: Date | null;

    @Column({ name: 'approved_by_user_id', type: 'varchar', nullable: true })
    approvedByUserId!: string | null;

    @Column({ name: 'approved_by_username', type: 'varchar', nullable: true })
    approvedByUsername!: string | null;

    @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
    usedAt!: Date | null;

    @Column({ name: 'request_ip', type: 'varchar', nullable: true })
    requestIp!: string | null;

    @Column({ name: 'approve_ip', type: 'varchar', nullable: true })
    approveIp!: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt!: Date;

    @Column({ name: 'used_for_customer_id', type: 'varchar', nullable: true })
    usedForCustomerId!: string | null;
}