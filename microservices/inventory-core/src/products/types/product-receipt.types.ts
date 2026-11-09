import { ProductKind } from '../../common/enums/product-kind.enum';
import { TrackingMode } from '../enums/product.enums';

export interface SearchProductsForReceiptQuery {
    search?: string;
    limit?: number;
    kind?: ProductKind;
    id?: string;
    supplierId?: string;
}

/**
 * Datos de un producto que necesita el módulo de ingresos (y otros módulos internos).
 * Los campos de `defaults` solo PRECARGAN la línea del ingreso; el lote guarda su propia copia.
 */
export interface ProductForReceipt {
    id: string;
    code: number;
    sku: string;
    name: string;
    kind: ProductKind;
    trackingMode: TrackingMode;
    modelIds: number[];
    defaults: {
        warrantyDays: number;
        basePrice: string;
        hasTax: boolean;
        billableInSales: boolean;
        priceIncludesTax: boolean;
        billableInRepairOrders: boolean;
    };
}

/** Item del buscador de productos para el formulario de ingreso. */
export interface ReceiptProductItem {
    id: string;
    code: number;
    sku: string;
    upc: string | null;
    name: string;
    kind: ProductKind;
    trackingMode: TrackingMode;
    typeCode: string;
    color: string | null;
    quality: string | null;
    models: Array<{ id: number; name: string; brand: string }>;
    defaults: {
        warrantyDays: number;
        salePrice: string;
        hasTax: boolean;
        priceIncludesTax: boolean;
        billableInSales: boolean;
        billableInRepairOrders: boolean;
    };
    lastReceipt: {
        receiptId: string;
        receiptCode: number;
        issueDate: string | Date;
        supplierName: string | null;
        lotId: string;
        lotCode: number;
        lotCreatedAt: Date;
        unitCost: string;
        documentUnitCost: string;
        discount: string;
        purchaseTaxCode: string | null;
        purchaseTaxRate: string | null;
        salePrice: string;
        warrantyDays: number;
        hasTax: boolean;
        priceIncludesTax: boolean;
        billableInSales: boolean;
        billableInRepairOrders: boolean;
    } | null;
    supplierCodes: Array<{ code: string; description: string | null; unitFactor: string | number }>;
}