import { EntityManager, In } from 'typeorm';
import { Lot } from '../entities/lot.entity';

export interface LotSnapshot {
    id: string;
    companyId: string;
    productId: string;
    code: number;
    originType: string;
    quantityReceived: number;
    salePrice: string;
    warrantyDays: number;
    hasTax: boolean;
    priceIncludesTax: boolean;
    billableInSales: boolean;
    billableInRepairOrders: boolean;
    createdAt: string; // ISO, ms
}

export async function buildLotSnapshots(em: EntityManager, ids: string[]): Promise<LotSnapshot[]> {
    if (!ids.length) return [];
    const lots = await em.find(Lot, { where: { id: In(ids) } });
    const byId = new Map(lots.map((l) => [l.id, l] as [string, Lot]));
    return ids
        .map((id) => byId.get(id))
        .filter((l): l is Lot => !!l)
        .map((l) => ({
            id: l.id,
            companyId: l.companyId,
            productId: l.productId,
            code: l.code,
            originType: l.originType,
            quantityReceived: l.quantityReceived,
            salePrice: l.salePrice,
            warrantyDays: l.warrantyDays,
            hasTax: l.hasTax,
            priceIncludesTax: l.priceIncludesTax,
            billableInSales: l.billableInSales,
            billableInRepairOrders: l.billableInRepairOrders,
            createdAt: l.createdAt.toISOString(),
        }));
}