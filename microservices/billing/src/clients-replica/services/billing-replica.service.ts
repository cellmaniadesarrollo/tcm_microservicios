import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingDataReplica } from '../entities/billing-data-replica.entity';
import { BillingSnapshot } from '../types/client-snapshots';

const CHUNK = 500; // 23 columnas × 500 < 65 535

const UPDATE_COLUMNS = [
    'company_id', 'id_type_id', 'id_type_code', 'id_type_name', 'id_number', 'person_type_id',
    'person_type_name', 'gender_name', 'first_name', 'last_name', 'trade_name', 'main_email', 'cellphone',
    'phone', 'birthdate', 'address', 'city', 'city_id', 'is_company_client', 'is_active', 'customer_ids',
    'created_at', 'updated_at',
];

@Injectable()
export class BillingReplicaService {
    private readonly logger = new Logger(BillingReplicaService.name);

    constructor(@InjectRepository(BillingDataReplica) private readonly repo: Repository<BillingDataReplica>) { }

    async upsertMany(items: BillingSnapshot[]): Promise<number> {
        const byId = new Map<string, BillingSnapshot>();
        for (const it of items ?? []) {
            if (!it?.id || !it.companyId || !it.updatedAt || !it.idType || !it.personType) {
                this.logger.warn(`Billing inválido ignorado: ${it?.id ?? 'sin id'}`);
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
            const rows = list.slice(i, i + CHUNK).map((s) => ({
                id: s.id,
                companyId: s.companyId,
                idTypeId: s.idType.id,
                idTypeCode: s.idType.code ?? null,
                idTypeName: s.idType.name ?? null,
                idNumber: s.idNumber,
                personTypeId: s.personType.id,
                personTypeName: s.personType.name,
                genderName: s.gender?.name ?? null,
                firstName: s.firstName,
                lastName: s.lastName ?? null,
                tradeName: s.tradeName ?? null,
                mainEmail: s.mainEmail,
                cellphone: s.cellphone ?? null,
                phone: s.phone ?? null,
                birthdate: s.birthdate ?? null,
                address: s.address,
                city: s.city ?? null,
                cityId: s.cityId ?? null,
                isCompanyClient: s.isCompanyClient,
                isActive: s.isActive,
                customerIds: s.customerIds ?? [],
                createdAt: new Date(s.createdAt),
                updatedAt: new Date(s.updatedAt),
            }));
            await this.repo.createQueryBuilder().insert().into(BillingDataReplica).values(rows)
                .onConflict(`("id") DO UPDATE SET ${setClause} WHERE "billing_data_replica"."updated_at" <= EXCLUDED."updated_at"`)
                .execute();
        }
        return list.length;
    }

    async getLastUpdatedAt(): Promise<Date | null> {
        const row = await this.repo.createQueryBuilder('b')
            .select('MAX(b.updated_at)', 'max').getRawOne<{ max: Date | null }>();
        return row?.max ?? null;
    }
}