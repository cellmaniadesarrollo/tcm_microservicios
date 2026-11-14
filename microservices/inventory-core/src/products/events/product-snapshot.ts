import { EntityManager, In } from 'typeorm';
import { Product } from '../entities/product.entity';

export interface ProductSnapshot {
    id: string;
    companyId: string;
    code: number;
    sku: string;
    upc: string | null;
    name: string;
    description: string | null;
    kind: string;
    trackingMode: string;
    productTypeId: string;
    productTypeCode: string;
    productTypeName: string;
    colorId: string | null;
    colorName: string | null;
    qualityId: string | null;
    qualityName: string | null;
    modelIds: number[];
    status: boolean;
    /** Solo informativos: precargan ingresos. Billing decide después si los usa. */
    defaults: {
        basePrice: string;
        hasTax: boolean;
        priceIncludesTax: boolean;
        billableInSales: boolean;
        billableInRepairOrders: boolean;
        warrantyDays: number;
    };
    createdAt: string; // ISO, precisión de ms
    updatedAt: string; // ISO, precisión de ms
}

/** Devuelve los snapshots en el mismo orden de `ids`. Los ids inexistentes se omiten. */
export async function buildProductSnapshots(
    em: EntityManager,
    ids: string[],
    companyId?: string,
): Promise<ProductSnapshot[]> {
    if (!ids.length) return [];

    const products = await em.find(Product, {
        where: companyId ? { id: In(ids), companyId } : { id: In(ids) },
        relations: {
            productName: true,
            productType: true,
            color: true,
            quality: true,
            compatibleModels: true,
        },
    });
    const byId = new Map(products.map((p) => [p.id, p] as [string, Product]));

    return ids
        .map((id) => byId.get(id))
        .filter((p): p is Product => !!p)
        .map((p) => ({
            id: p.id,
            companyId: p.companyId,
            code: p.code,
            sku: p.sku,
            upc: p.upc ?? null,
            name: p.productName?.name ?? p.sku,
            description: p.description ?? null,
            kind: p.kind,
            trackingMode: p.trackingMode,
            productTypeId: p.productTypeId,
            productTypeCode: p.productType.code,
            productTypeName: p.productType.name,
            colorId: p.colorId ?? null,
            colorName: p.color?.name ?? null,
            qualityId: p.qualityId ?? null,
            qualityName: p.quality?.name ?? null,
            modelIds: (p.compatibleModels ?? []).map((m) => m.modelId).sort((a, b) => a - b),
            status: p.status,
            defaults: {
                basePrice: p.basePrice,
                hasTax: p.hasTax,
                priceIncludesTax: p.priceIncludesTax,
                billableInSales: p.billableInSales,
                billableInRepairOrders: p.billableInRepairOrders,
                warrantyDays: p.warrantyDays,
            },
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
        }));
}