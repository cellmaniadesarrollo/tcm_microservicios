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
    defaults: {
        basePrice: string;
        hasTax: boolean;
        priceIncludesTax: boolean;
        billableInSales: boolean;
        billableInRepairOrders: boolean;
        warrantyDays: number;
    };
    createdAt: string;
    updatedAt: string;
}