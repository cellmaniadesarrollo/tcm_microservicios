import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEmployeeCache } from '../entities/user_employee_cache.entity';
import { CUSTOMER_AUTH_RECIPIENT_GROUPS } from '../constants/authorizer-groups';


@Injectable()
export class UsersEmployeesEventsService {
    constructor(
        @InjectRepository(UserEmployeeCache)
        private readonly repo: Repository<UserEmployeeCache>,
    ) { }

    // ⚠️ Ajusta a la forma que espera tu MS de usuarios en `fromCache`
    async getLastUpdatedAt(): Promise<Date | null> {
        const row = await this.repo
            .createQueryBuilder('u')
            .select('MAX(u.updatedAt)', 'max')
            .getRawOne();
        return row?.max ?? null;
    }

    // ⚠️ Único punto de mapeo: ajusta a tu payload real
    private toRow(u: any): Partial<UserEmployeeCache> {
        const e = u.employee ?? null;

        const join = (...parts: (string | undefined | null)[]) =>
            parts.map((p) => p?.trim()).filter(Boolean).join(' ') || null;

        return {
            id: u.id,
            username: u.name_user ?? null,
            firstName: join(e?.first_name1, e?.first_name2),
            lastName: join(e?.last_name1, e?.last_name2),
            // Prioridad: email del usuario, luego el corporativo, luego el personal
            email: u.email_user ?? e?.email_business ?? e?.email_personal ?? null,
            companyId: u.company?.id,
            groups: (u.userGroups ?? []).map((g: any) =>
                typeof g === 'string' ? g : g.group_name ?? g.name ?? g.group?.group_name ?? g.group?.name,
            ).filter(Boolean),
            isCompanyAdmin: false, // pendiente, ver abajo
            isActive: u.state_user ?? true,
            createdAt: u.createdAt ?? null,
            updatedAt: u.updatedAt ?? null,
        };
    }

    // RabbitMQ: reconciliación bulk
    async syncUsersEmployeesBulk(users: any[]) {
        if (!Array.isArray(users) || !users.length) return;
        const rows = users.map((u) => this.toRow(u));
        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
            await this.repo.upsert(rows.slice(i, i + CHUNK) as any, ['id']);
        }
    }

    // Kafka: created/updated
    async upsertUser(payload: any) {
        await this.repo.upsert(this.toRow(payload) as any, ['id']);
    }

    // Kafka: deleted
    async removeUser(id: string) {
        await this.repo.delete({ id });
    }

    // Para el paso 2 (solicitud de autorización)
    async findAuthorizerRecipients(companyId: string, excludeUserId?: string) {
        const qb = this.repo
            .createQueryBuilder('u')
            .where('u.companyId = :companyId', { companyId })
            .andWhere('u.isActive = true')
            .andWhere('u.groups && ARRAY[:...groups]::text[]', {
                groups: CUSTOMER_AUTH_RECIPIENT_GROUPS,
            });
        if (excludeUserId) qb.andWhere('u.id != :excludeUserId', { excludeUserId });
        return qb.getMany();
    }

    findById(id: string) {
        return this.repo.findOne({ where: { id } });
    }
    async isAuthorizer(userId: string, companyId: string): Promise<boolean> {
        const count = await this.repo
            .createQueryBuilder('u')
            .where('u.id = :userId', { userId })
            .andWhere('u.companyId = :companyId', { companyId })
            .andWhere('u.isActive = true')
            .andWhere('(u.groups && ARRAY[:...groups]::text[] OR u.isCompanyAdmin = true)', {
                groups: CUSTOMER_AUTH_RECIPIENT_GROUPS,
            })
            .getCount();
        return count > 0;
    }
}