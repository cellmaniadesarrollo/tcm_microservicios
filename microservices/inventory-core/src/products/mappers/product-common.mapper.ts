import { Product } from '../entities/product.entity';
import { ProductModel } from '../entities/product-model.entity';
import { ProductUsageLink } from '../entities/product-usage-link.entity';
import { deriveStockStatus } from '../helpers/stock.helpers';

export const mapType = (p: Product) => ({
    id: p.productType.id,
    name: p.productType.name,
    code: p.productType.code,
});

export const mapColor = (p: Product) =>
    p.color ? { id: p.color.id, name: p.color.name, hex: p.color.hex ?? null } : null;

export const mapQuality = (p: Product) =>
    p.quality ? { id: p.quality.id, name: p.quality.name } : null;

/** Marcas únicas de los modelos compatibles. */
export function mapBrands(links: ProductModel[]) {
    const brands = new Map<number, string>();
    for (const l of links) brands.set(l.model.brand.brands_id, l.model.brand.brands_name);
    return [...brands].map(([id, name]) => ({ id, name }));
}

/** Usos del producto, ordenados por nombre. */
export function mapUsages(links: ProductUsageLink[]) {
    return links
        .map((ul) => ({ id: ul.usage.id, code: ul.usage.code, name: ul.usage.name, area: ul.usage.area }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Stock mínimo y valores POR DEFECTO para nuevos lotes
 * (no son la condición real de lo que hay en stock).
 */
export const mapProductDefaults = (p: Product) => ({
    minStock: p.minStock,
    warrantyDays: p.warrantyDays,
    basePrice: p.basePrice,
    hasTax: p.hasTax,
    priceIncludesTax: p.priceIncludesTax,
    billableInSales: p.billableInSales,
    billableInRepairOrders: p.billableInRepairOrders,
});

/** Resumen de stock a partir de una fila agregada (puede no existir si nunca hubo stock). */
export function mapStock(row: any | undefined, minStock: number) {
    const onHand = Number(row?.onHand ?? 0);
    const reserved = Number(row?.reserved ?? 0);
    const available = onHand - reserved;

    return {
        onHand,
        reserved,
        available,
        availableBillableInSales: Number(row?.availableBillableInSales ?? 0),
        availableBillableInRepairOrders: Number(row?.availableBillableInRepairOrders ?? 0),
        lotsWithStock: Number(row?.lotsWithStock ?? 0),
        salePriceMin: row?.salePriceMin ?? null,
        salePriceMax: row?.salePriceMax ?? null,
        status: deriveStockStatus(available, minStock),
    };
}