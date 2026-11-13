import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LotReplica } from '../entities/lot-replica.entity';

export interface LotSnapshot {
    id: string; companyId: string; productId: string; code: number; originType: string;
    quantityReceived: number; salePrice: string; warrantyDays: number;
    hasTax: boolean; priceIncludesTax: boolean;
    billableInSales: boolean; billableInRepairOrders: boolean;
    createdAt: string;
}

const CHUNK = 500;
const UPDATE_COLUMNS = [
    'company_id', 'product_id', 'code', 'origin_type', 'quantity_received', 'sale_price',
    'warranty_days', 'has_tax', 'price_includes_tax', 'billable_in_sales',
    'billable_in_repair_orders', 'created_at',
];

@Injectable()
export class LotsReplicaService {
    private readonly logger = new Logger(LotsReplicaService.name);

    constructor(@InjectRepository(LotReplica) private readonly repo: Repository<LotReplica>) { }

    /** Upsert idempotente. Los lotes no cambian, así que un reenvío simplemente reescribe lo mismo. */
    async upsertMany(items: LotSnapshot[]): Promise<number> {
        const byId = new Map<string, LotSnapshot>();
        for (const it of items ?? []) {
            if (!it?.id || !it.companyId || !it.productId || !it.createdAt) {
                this.logger.warn(`Lote inválido ignorado: ${it?.id ?? 'sin id'}`);
                continue;
            }
            byId.set(it.id, it);
        }
        const list = [...byId.values()];
        if (!list.length) return 0;

        const setClause = [...UPDATE_COLUMNS.map((c) => `"${c}" = EXCLUDED."${c}"`), `"synced_at" = now()`].join(', ');

        for (let i = 0; i < list.length; i += CHUNK) {
            const rows = list.slice(i, i + CHUNK).map((s) => ({
                id: s.id, companyId: s.companyId, productId: s.productId, code: s.code,
                originType: s.originType, quantityReceived: s.quantityReceived, salePrice: s.salePrice,
                warrantyDays: s.warrantyDays, hasTax: s.hasTax, priceIncludesTax: s.priceIncludesTax,
                billableInSales: s.billableInSales, billableInRepairOrders: s.billableInRepairOrders,
                createdAt: new Date(s.createdAt),
            }));
            await this.repo.createQueryBuilder().insert().into(LotReplica).values(rows)
                .onConflict(`("id") DO UPDATE SET ${setClause}`).execute();
        }
        return list.length;
    }

    async getLastCreatedAt(): Promise<Date | null> {
        const row = await this.repo.createQueryBuilder('l')
            .select('MAX(l.created_at)', 'max').getRawOne<{ max: Date | null }>();
        return row?.max ?? null;
    }
}