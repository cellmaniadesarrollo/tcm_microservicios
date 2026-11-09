import { Product } from '../entities/product.entity';
import { ProductModel } from '../entities/product-model.entity';
import { ProductUsageLink } from '../entities/product-usage-link.entity';
import { groupBy, indexBy } from '../helpers/group.helpers';
import {
    mapBrands,
    mapColor,
    mapProductDefaults,
    mapQuality,
    mapStock,
    mapType,
    mapUsages,
} from './product-common.mapper';

/** Datos de la página actual que se consultan aparte de los productos. */
export interface ProductListExtras {
    links: ProductModel[];
    usageLinks: ProductUsageLink[];
    imageUrls: Map<string, string | null>;
    stockRows: any[];
    lastLotRows: any[];
}

export function mapProductListItems(rows: Product[], extras: ProductListExtras) {
    const modelsByProduct = groupBy(extras.links, (l) => l.productId);
    const usagesByProduct = groupBy(extras.usageLinks, (ul) => ul.productId);
    const stockByProduct = indexBy(extras.stockRows, (r) => r.productId as string);
    const lastLotByProduct = indexBy(extras.lastLotRows, (r) => r.productId as string);

    return rows.map((p) => {
        const productLinks = modelsByProduct.get(p.id) ?? [];
        const lastLot = lastLotByProduct.get(p.id);

        return {
            id: p.id,
            code: p.code,
            sku: p.sku,
            upc: p.upc ?? null,
            name: p.productName.name,
            description: p.description ?? null,
            kind: p.kind,
            trackingMode: p.trackingMode,
            type: mapType(p),
            color: mapColor(p),
            quality: mapQuality(p),
            brands: mapBrands(productLinks),
            models: productLinks.map((l) => ({ id: l.model.models_id, name: l.model.models_name })),
            usages: mapUsages(usagesByProduct.get(p.id) ?? []),
            ...mapProductDefaults(p),
            status: p.status,
            imageUrl: extras.imageUrls.get(p.id) ?? null,
            createdAt: p.createdAt,
            stock: mapStock(stockByProduct.get(p.id), p.minStock),
            lastLot: lastLot
                ? {
                    code: Number(lastLot.code),
                    unitCost: lastLot.unitCost,
                    salePrice: lastLot.salePrice,
                    createdAt: lastLot.createdAt,
                }
                : null,
        };
    });
}