import { DETAIL_MAX_LOTS, DETAIL_MAX_UNITS } from '../constants/product.constants';
import { Product } from '../entities/product.entity';
import { groupBy, truncate } from '../helpers/group.helpers';
import { TrackingMode } from '../enums/product.enums';
import { StockUnitSerial } from '../../stock/entities/stock-unit-serial.entity';
import {
    mapBrands,
    mapColor,
    mapProductDefaults,
    mapQuality,
    mapStock,
    mapType,
    mapUsages,
} from './product-common.mapper';

/** Todo lo que consulta `ProductDetailQuery` para armar el detalle. */
export interface ProductDetailData {
    product: Product;              // con productName, productType, color, quality, compatibleModels, usages
    images: unknown;
    history: unknown;
    totalsRow: any | undefined;    // resumen de stock
    lotRows: any[];                // hasta DETAIL_MAX_LOTS + 1
    unitCounts: any[];             // conteo por estado (solo serializados)
    unitRows: any[];               // hasta DETAIL_MAX_UNITS + 1 (solo serializados)
    serialRows: StockUnitSerial[]; // IMEI de los equipos mostrados
    movementRows: any[];
}

function mapLots(lotRows: any[]) {
    const { items, truncated } = truncate(lotRows, DETAIL_MAX_LOTS);

    const lots = items.map((l: any) => {
        const quantityReceived = Number(l.quantityReceived);
        const onHand = Number(l.onHand);
        const reserved = Number(l.reserved);

        return {
            id: l.id,
            code: Number(l.code),
            originType: l.originType,
            quantityReceived,
            onHand,
            reserved,
            available: onHand - reserved,
            consumed: quantityReceived - onHand,
            unitCost: l.unitCost, // neto por unidad, sin impuesto
            salePrice: l.salePrice,
            warrantyDays: Number(l.warrantyDays),
            hasTax: l.hasTax,
            priceIncludesTax: l.priceIncludesTax,
            billableInSales: l.billableInSales,
            billableInRepairOrders: l.billableInRepairOrders,
            createdAt: l.createdAt,
            createdById: l.createdById,
            receipt: l.receiptId
                ? {
                    id: l.receiptId,
                    code: Number(l.receiptCode),
                    issueDate: l.issueDate,
                    documentNumber: l.documentNumber ?? null,
                    status: l.receiptStatus,
                    supplierName: l.supplierName ?? null,
                }
                : null,
        };
    });

    return { lots, truncated };
}

function mapUnits(unitRows: any[], unitCounts: any[], serialRows: StockUnitSerial[]) {
    const { items, truncated } = truncate(unitRows, DETAIL_MAX_UNITS);

    const serialsByUnit = groupBy(serialRows, (s) => s.unitId);
    const byStatus: Record<string, number> = {};
    for (const r of unitCounts) byStatus[r.status] = Number(r.n);

    return {
        byStatus,
        items: items.map((u: any) => ({
            id: u.id,
            status: u.status,
            lotCode: Number(u.lotCode),
            serials: serialsByUnit.get(u.id)?.map((s) => s.value) ?? [u.serial],
            createdAt: u.createdAt,
        })),
        truncated,
    };
}

function mapMovements(movementRows: any[]) {
    return movementRows.map((m: any) => ({
        id: m.id,
        type: m.type,
        quantity: Number(m.quantity),
        lotCode: Number(m.lotCode),
        unitCost: m.unitCost,
        referenceType: m.referenceType ?? null,
        referenceId: m.referenceId ?? null,
        createdById: m.createdById,
        occurredAt: m.occurredAt,
    }));
}

export function mapProductDetail(data: ProductDetailData) {
    const { product: p, totalsRow } = data;
    const isSerial = p.trackingMode === TrackingMode.SERIAL;
    const { lots, truncated: lotsTruncated } = mapLots(data.lotRows);

    return {
        id: p.id,
        code: p.code,
        sku: p.sku,
        upc: p.upc ?? null,
        description: p.description ?? null,
        kind: p.kind,
        trackingMode: p.trackingMode,
        name: { id: p.productName.id, name: p.productName.name },
        type: mapType(p),
        color: mapColor(p),
        quality: mapQuality(p),
        brands: mapBrands(p.compatibleModels),
        models: p.compatibleModels.map((l) => ({
            id: l.model.models_id,
            name: l.model.models_name,
            brandId: l.model.brand.brands_id,
            brandName: l.model.brand.brands_name,
        })),
        usages: mapUsages(p.usages),
        ...mapProductDefaults(p),
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        images: data.images,

        stock: {
            ...mapStock(totalsRow, p.minStock),
            avgUnitCost: totalsRow?.avgUnitCost ?? null, // costo promedio ponderado de lo que hay en existencia
        },
        lots,
        lotsTruncated,
        units: isSerial ? mapUnits(data.unitRows, data.unitCounts, data.serialRows) : null,
        movements: mapMovements(data.movementRows),
        history: data.history,
    };
}