import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { CustomerCache } from '../entities/customer-cache.entity';
import { CustomerContactCache } from '../entities/customer-contact-cache.entity';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';
import { CustomerSnapshot } from '../types/client-snapshots';

const CHUNK = 500;
const CONTACT_CHUNK = 1000;

const UPDATE_COLUMNS = ['companyId', 'idTypeName', 'idNumber', 'firstName', 'lastName', 'createdAt', 'updatedAt'];

@Injectable()
export class CustomersCacheService {
    private readonly logger = new Logger(CustomersCacheService.name);

    constructor(private readonly dataSource: DataSource) { }

    /**
     * Upsert idempotente con guard de fecha. Los contactos se reemplazan en la misma
     * transacción, solo para los clientes cuya fila fue realmente aplicada.
     */
    async upsertMany(items: CustomerSnapshot[]): Promise<number> {
        const byId = new Map<number, CustomerSnapshot>();
        for (const it of items ?? []) {
            if (!it?.id || !it.companyId || !it.updatedAt || !it.idType) {
                this.logger.warn(`Cliente inválido ignorado: ${it?.id ?? 'sin id'}`);
                continue;
            }
            const prev = byId.get(it.id);
            if (!prev || prev.updatedAt <= it.updatedAt) byId.set(it.id, it);
        }
        let list = [...byId.values()];
        if (!list.length) return 0;

        // customers_cache.company es FK obligatoria a CompanyReplica: se omiten los que no tengan empresa aún
        const companyIds = [...new Set(list.map((s) => s.companyId))];
        const found = await this.dataSource.getRepository(CompanyReplica).find({
            select: ['id'] as any,
            where: { id: In(companyIds) } as any,
        });
        const known = new Set(found.map((c: any) => String(c.id)));
        const missing = list.filter((s) => !known.has(s.companyId));
        if (missing.length) {
            this.logger.warn(
                `${missing.length} cliente(s) omitidos: empresa aún no replicada (${[...new Set(missing.map((m) => m.companyId))].join(', ')}). Los recupera el próximo sync.`,
            );
            list = list.filter((s) => known.has(s.companyId));
        }

        let applied = 0;
        for (let i = 0; i < list.length; i += CHUNK) {
            const part = list.slice(i, i + CHUNK);
            try {
                await this.dataSource.transaction((em) => this.writeChunk(em, part));
                applied += part.length;
            } catch (e: any) {
                // Un registro malo (p. ej. choque del índice único company+idNumber) no debe tumbar el lote
                this.logger.warn(`Lote falló (${e?.message}); reintentando fila por fila`);
                for (const one of part) {
                    try {
                        await this.dataSource.transaction((em) => this.writeChunk(em, [one]));
                        applied++;
                    } catch (err: any) {
                        this.logger.error(`Cliente ${one.id} no sincronizado: ${err?.message}`);
                    }
                }
            }
        }
        return applied;
    }

    private async writeChunk(em: EntityManager, part: CustomerSnapshot[]) {
        const setClause = UPDATE_COLUMNS.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ');

        const res = await em
            .createQueryBuilder()
            .insert()
            .into(CustomerCache)
            .values(part.map((s) => ({
                id: s.id,
                company: { id: s.companyId } as any,
                idNumber: s.idNumber,
                idTypeName: s.idType.name ?? undefined,
                firstName: s.firstName,
                lastName: s.lastName ?? '',
                createdAt: new Date(s.createdAt),
                updatedAt: new Date(s.updatedAt),
            })))
            .onConflict(
                `("id") DO UPDATE SET ${setClause} WHERE "customers_cache"."updatedAt" IS NULL OR "customers_cache"."updatedAt" <= EXCLUDED."updatedAt"`,
            )
            .returning('id')
            .execute();

        const applied = new Set<number>((res.raw as Array<{ id: number }>).map((r) => Number(r.id)));
        if (!applied.size) return;

        await em.query(`DELETE FROM contacts_cache WHERE "customerId" = ANY($1::int[])`, [[...applied]]);

        const contacts = part
            .filter((s) => applied.has(s.id))
            .flatMap((s) => (s.contacts ?? []).map((c) => ({
                customer: { id: s.id } as any,
                typeName: String(c.type ?? 'OTHER').slice(0, 100),
                value: String(c.value ?? '').slice(0, 150),
                isPrimary: !!c.isPrimary,
            })));

        for (let j = 0; j < contacts.length; j += CONTACT_CHUNK) {
            await em.insert(CustomerContactCache, contacts.slice(j, j + CONTACT_CHUNK));
        }
    }

    async getLastUpdatedAt(): Promise<Date | null> {
        const row = await this.dataSource
            .getRepository(CustomerCache)
            .createQueryBuilder('c')
            .select('MAX(c.updatedAt)', 'max')
            .getRawOne<{ max: Date | null }>();
        return row?.max ?? null;
    }
}