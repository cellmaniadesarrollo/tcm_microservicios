import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CustomerReplica } from '../entities/customer-replica.entity';
import { CustomerContactReplica } from '../entities/customer-contact-replica.entity';
import { CustomerSnapshot } from '../types/client-snapshots';

const CHUNK = 200;           // 17 columnas × 200 < 65 535 parámetros
const CONTACT_CHUNK = 1000;

const UPDATE_COLUMNS = [
    'company_id', 'id_type_id', 'id_type_code', 'id_type_name', 'id_number', 'first_name', 'last_name',
    'birth_date', 'gender_name', 'is_active', 'addresses', 'created_at', 'updated_at',
];

@Injectable()
export class CustomersReplicaService {
    private readonly logger = new Logger(CustomersReplicaService.name);

    constructor(private readonly dataSource: DataSource) { }

    /**
     * Upsert idempotente con guard de fecha. Los contactos de un cliente se reemplazan
     * (en la misma transacción) SOLO si su fila fue realmente aplicada.
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
        const list = [...byId.values()];
        if (!list.length) return 0;

        const setClause = [
            ...UPDATE_COLUMNS.map((c) => `"${c}" = EXCLUDED."${c}"`),
            `"synced_at" = now()`,
        ].join(', ');

        for (let i = 0; i < list.length; i += CHUNK) {
            const part = list.slice(i, i + CHUNK);

            await this.dataSource.transaction(async (em) => {
                const res = await em
                    .createQueryBuilder()
                    .insert()
                    .into(CustomerReplica)
                    .values(part.map((s) => ({
                        id: s.id,
                        companyId: s.companyId,
                        idTypeId: s.idType.id,
                        idTypeCode: s.idType.code ?? null,
                        idTypeName: s.idType.name ?? null,
                        idNumber: s.idNumber,
                        firstName: s.firstName,
                        lastName: s.lastName,
                        birthDate: s.birthDate ?? null,
                        genderName: s.gender?.name ?? null,
                        isActive: s.isActive,
                        addresses: (s.addresses ?? []) as any,
                        createdAt: new Date(s.createdAt),
                        updatedAt: new Date(s.updatedAt),
                    })))
                    .onConflict(
                        `("id") DO UPDATE SET ${setClause} WHERE "customers_replica"."updated_at" <= EXCLUDED."updated_at"`,
                    )
                    .returning('id')
                    .execute();

                const applied = new Set<number>((res.raw as Array<{ id: number }>).map((r) => Number(r.id)));
                if (!applied.size) return;

                await em.query(`DELETE FROM customer_contacts_replica WHERE customer_id = ANY($1::int[])`, [[...applied]]);

                const contacts = part
                    .filter((s) => applied.has(s.id))
                    .flatMap((s) => (s.contacts ?? []).map((c) => ({
                        customerId: s.id,
                        companyId: s.companyId,
                        contactType: String(c.type ?? 'OTHER').slice(0, 30),
                        value: String(c.value ?? '').slice(0, 100),
                        isPrimary: !!c.isPrimary,
                    })));

                for (let j = 0; j < contacts.length; j += CONTACT_CHUNK) {
                    await em.insert(CustomerContactReplica, contacts.slice(j, j + CONTACT_CHUNK));
                }
            });
        }
        return list.length;
    }

    async getLastUpdatedAt(): Promise<Date | null> {
        const rows: Array<{ max: Date | null }> = await this.dataSource.query(
            `SELECT MAX(updated_at) AS max FROM customers_replica`,
        );
        return rows[0]?.max ?? null;
    }
}