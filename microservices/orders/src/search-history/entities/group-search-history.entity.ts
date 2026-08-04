import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
    Unique,
} from 'typeorm';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';
import { GroupCache } from '../../users-employees-events/entities/group_cache.entity';
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';

export enum SearchType {
    ORDER = 'order',
    CLIENT = 'client',
    // Agrega más según crezca el sistema
}

/**
 * Historial de búsquedas compartido por grupo.
 * - Filtro actual  → (company_id + group_id)
 * - Filtro futuro  → (company_id + user_id)
 * El UNIQUE en (company_id, group_id, user_id, search_term, search_type)
 * permite el upsert: si el término ya existe solo se actualiza searched_at.
 */
@Unique('uq_search_term_per_group_user', [
    'companyId',
    'groupId',
    'userId',
    'searchTerm',
    'searchType',
])
@Entity('group_search_history')
export class GroupSearchHistory {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    // ── Tenant isolation ────────────────────────────────────────────────────────
    @Column({ name: 'company_id' })
    @Index('idx_gsh_company')
    companyId!: string;

    @ManyToOne(() => CompanyReplica, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'company_id' })
    company!: CompanyReplica;

    // ── Grupo (modo actual) ─────────────────────────────────────────────────────
    @Column({ name: 'group_id' })
    groupId!: string;

    @ManyToOne(() => GroupCache, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'group_id' })
    group!: GroupCache;

    // ── Usuario (auditoría + modo futuro) ───────────────────────────────────────
    @Column({ name: 'user_id' })
    userId!: string;

    @ManyToOne(() => UserEmployeeCache, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'user_id' })
    user!: UserEmployeeCache;

    // ── Payload de búsqueda ─────────────────────────────────────────────────────
    @Column({ name: 'search_term', length: 200 })
    searchTerm!: string;

    @Column({
        name: 'search_type',
        type: 'enum',
        enum: SearchType,
        default: SearchType.ORDER,
    })
    searchType!: SearchType;

    @Column({ name: 'result_count', type: 'int' })
    resultCount!: number;

    // ── Timestamp (se actualiza en cada upsert) ─────────────────────────────────
    @Column({
        name: 'searched_at',
        type: 'timestamp',
        default: () => 'now()',
    })
    searchedAt!: Date;
}