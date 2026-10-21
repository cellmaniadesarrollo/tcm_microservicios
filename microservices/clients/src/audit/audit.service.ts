import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /** Devuelve solo los campos que cambiaron (null y undefined se tratan igual) */
  diff(before: any, after: any) {
    const changes: Record<string, { old: any; new: any }> = {};
    for (const key of Object.keys(before)) {
      if (JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)) {
        changes[key] = { old: before[key] ?? null, new: after[key] ?? null };
      }
    }
    return Object.keys(changes).length ? changes : null;
  }

  snapshot(data: any) {
    const out: Record<string, { old: any; new: any }> = {};
    for (const [k, v] of Object.entries(data ?? {})) {
      if (v === null || v === undefined || v === '') continue;
      out[k] = { old: null, new: v };
    }
    return Object.keys(out).length ? out : null;
  }

  async log(p: {
    entity: string;
    entityId: string | number;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    user: any;
    source?: 'BILLING' | 'ORDERS';
    changes?: Record<string, { old: any; new: any }> | null;
  }) {
    try {
      // El JWT trae el ID del usuario como `sub`
      const rawUserId = p.user?.sub ?? p.user?.userId ?? p.user?.id;

      await this.repo.save(
        this.repo.create({
          entity: p.entity,
          entityId: String(p.entityId),
          action: p.action,
          source: p.source ?? p.user?.source ?? 'ORDERS', // antes 'BILLING'
          userId: rawUserId != null ? String(rawUserId) : null,
          userName:
            p.user?.username ?? p.user?.name ?? p.user?.fullName ?? p.user?.email ?? null,
          companyId: p.user?.companyId != null ? String(p.user.companyId) : null,
          changes: p.changes ?? null,
        }),
      );
    } catch (e) {
      // La auditoría nunca debe romper la operación principal
      this.logger.error('Error guardando audit log', e);
    }
  }

  /** Historial completo de un registro (filtrado por empresa) */
  getHistory(entity: string, entityId: string | number, companyId: string | number) {
    return this.repo.find({
      where: { entity, entityId: String(entityId), companyId: String(companyId) },
      order: { createdAt: 'DESC' },
    });
  }
}