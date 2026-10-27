import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AuditAction } from '../enums/audit-action.enum';


export type AuditChange = { from?: unknown; to?: unknown };

/**
 * Bitácora genérica y de solo-inserción: una fila por cada acción sobre cualquier tabla.
 * No tiene FK hacia la entidad auditada (así sirve para todas y sobrevive al borrado físico).
 */
@Entity('audit_logs')
@Index('idx_audit_entity', ['companyId', 'entityName', 'entityId', 'createdAt'])
@Index('idx_audit_company_date', ['companyId', 'createdAt'])
@Index('idx_audit_user', ['companyId', 'userId', 'createdAt'])
export class AuditLog {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    /** Nombre de la tabla auditada. ej: products */
    @Column({ name: 'entity_name', length: 100 })
    entityName!: string;

    /** Id del registro auditado (texto, para servir tanto a uuid como a int). */
    @Column({ name: 'entity_id', length: 64 })
    entityId!: string;

    @Column({ type: 'enum', enum: AuditAction })
    action!: AuditAction;

    /** Usuario que hizo la acción (réplica de usuarios, sin FK). Null = proceso del sistema. */
    @Column({ name: 'user_id', type: 'uuid', nullable: true })
    userId!: string | null;

    /**
     * UPDATED: { campo: { from, to } } solo con lo que cambió.
     * DELETED: { campo: { from } } con el último estado del registro.
     * Resto de acciones: null.
     */
    @Column({ type: 'jsonb', nullable: true })
    changes!: Record<string, AuditChange> | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
}