import { Product } from '../entities/product.entity';
import { groupBy, indexBy } from '../helpers/group.helpers';
import { ProductForReceipt, ReceiptProductItem } from '../types/product-receipt.types';

/** Datos auxiliares que se consultan aparte de las filas base del buscador. */
export interface ReceiptItemExtras {
    modelRows: any[];
    lastRows: any[];
    codeRows: any[];
}

/** Filas crudas del buscador → items del formulario de ingreso: modelos, defaults y último ingreso. */
export function mapReceiptItems(rows: any[], extras: ReceiptItemExtras): ReceiptProductItem[] {
    const modelsByProduct = groupBy(extras.modelRows, (m) => m.productId as string);
    const lastByProduct = indexBy(extras.lastRows, (r) => r.productId as string);
    const codesByProduct = groupBy(extras.codeRows, (c) => c.productId as string);

    return rows.map((r) => {
        const last = lastByProduct.get(r.id);

        return {
            id: r.id,
            code: Number(r.code),
            sku: r.sku,
            upc: r.upc ?? null,
            name: r.name,
            kind: r.kind,
            trackingMode: r.trackingMode,
            typeCode: r.typeCode,
            color: r.colorName ?? null,
            quality: r.qualityName ?? null,
            models: (modelsByProduct.get(r.id) ?? []).map((m) => ({
                id: m.modelId,
                name: m.modelName,
                brand: m.brandName,
            })),
            // Valores del producto: precargan la línea si nunca se ha ingresado
            defaults: {
                warrantyDays: Number(r.warrantyDays),
                salePrice: r.basePrice,
                hasTax: r.hasTax,
                priceIncludesTax: r.priceIncludesTax,
                billableInSales: r.billableInSales,
                billableInRepairOrders: r.billableInRepairOrders,
            },
            // Referencia del último ingreso (null si nunca se ingresó)
            lastReceipt: last
                ? {
                    receiptId: last.receiptId,
                    receiptCode: Number(last.receiptCode),
                    issueDate: last.issueDate,
                    supplierName: last.supplierName ?? null,
                    lotId: last.lotId,
                    lotCode: Number(last.lotCode),
                    lotCreatedAt: last.lotCreatedAt,
                    unitCost: last.lotUnitCost,              // costo NETO del lote
                    documentUnitCost: last.documentUnitCost, // costo bruto según el documento
                    discount: last.discount,
                    purchaseTaxCode: last.purchaseTaxCode ?? null,
                    purchaseTaxRate: last.purchaseTaxRate ?? null,
                    salePrice: last.salePrice,
                    warrantyDays: Number(last.warrantyDays),
                    hasTax: last.hasTax,
                    priceIncludesTax: last.priceIncludesTax,
                    billableInSales: last.billableInSales,
                    billableInRepairOrders: last.billableInRepairOrders,
                }
                : null,
            supplierCodes: (codesByProduct.get(r.id) ?? []).map((c) => ({
                code: c.code,
                description: c.description ?? null,
                unitFactor: c.unitFactor,
            })),
        };
    });
}

/** Producto (con productName y compatibleModels) → forma mínima que usa el módulo de ingresos. */
export function mapProductForReceipt(p: Product): ProductForReceipt {
    return {
        id: p.id,
        code: p.code,
        sku: p.sku,
        name: p.productName.name,
        kind: p.kind,
        trackingMode: p.trackingMode,
        modelIds: p.compatibleModels.map((m) => m.modelId),
        defaults: {
            warrantyDays: p.warrantyDays,
            basePrice: p.basePrice,
            hasTax: p.hasTax,
            billableInSales: p.billableInSales,
            priceIncludesTax: p.priceIncludesTax,
            billableInRepairOrders: p.billableInRepairOrders,
        },
    };
}