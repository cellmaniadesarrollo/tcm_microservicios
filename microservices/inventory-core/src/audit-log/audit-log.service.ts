import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import { AuditAction } from './enums/audit-action.enum';
import { AuditChange, AuditLog } from './entities/audit-log.entity';
/** Campos que nunca se registran como cambio (los maneja la propia BD). */
const IGNORED_FIELDS = new Set(['createdAt', 'updatedAt', 'deletedAt']);

export interface AuditParams {
    companyId: string;
    entity: EntityTarget<ObjectLiteral>;
    entityId: string | number;
    action: AuditAction;
    userId?: string;
    before?: ObjectLiteral | null;
    after?: ObjectLiteral | null;
    /** Cambios ya armados (eventos que no son un diff de columnas, ej. imágenes). Tienen prioridad sobre before/after. */
    changes?: Record<string, AuditChange> | null;
}
@Injectable()
export class AuditLogService {
    constructor(private readonly dataSource: DataSource) { }

    /**
     * Registra una acción. Recibe el EntityManager de la transacción en curso para que
     * el cambio y su registro de auditoría se confirmen (o se reviertan) juntos.
     * Un UPDATED sin cambios reales no escribe nada.
     */
    async log(em: EntityManager, p: AuditParams): Promise<void> {
        const changes = this.buildChanges(p);
        if (p.action === AuditAction.UPDATED && !changes) return;

        await em.save(
            em.create(AuditLog, {
                companyId: p.companyId,
                entityName: em.connection.getMetadata(p.entity).tableName,
                entityId: String(p.entityId),
                action: p.action,
                userId: p.userId ?? null,
                changes,
            }),
        );
    }

    /** Historial de un registro, del más reciente al más antiguo. */
    async history(companyId: string, entity: EntityTarget<ObjectLiteral>, entityId: string | number, page = 1, limit = 20) {
        const [items, total] = await this.dataSource.getRepository(AuditLog).findAndCount({
            where: {
                companyId,
                entityName: this.dataSource.getMetadata(entity).tableName,
                entityId: String(entityId),
            },
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
        return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }

    private buildChanges(p: AuditParams): Record<string, AuditChange> | null {
        const out: Record<string, AuditChange> = {};

        if (p.action === AuditAction.UPDATED && p.before && p.after) {
            for (const key of Object.keys(p.after)) {
                if (IGNORED_FIELDS.has(key)) continue;
                const from = p.before[key] ?? null;
                const to = p.after[key] ?? null;
                if (JSON.stringify(from) !== JSON.stringify(to)) out[key] = { from, to };
            }
        } else if (p.action === AuditAction.DELETED && p.before) {
            for (const [key, value] of Object.entries(p.before)) {
                if (IGNORED_FIELDS.has(key) || typeof value === 'object' && value !== null && !(value instanceof Date)) continue;
                out[key] = { from: value };
            }
        }

        return Object.keys(out).length ? out : null;
    }

}
