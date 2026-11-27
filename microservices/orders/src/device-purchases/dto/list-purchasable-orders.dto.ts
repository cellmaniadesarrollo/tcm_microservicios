// device-purchases/dto/list-purchasable-orders.dto.ts
export type PurchaseStatusFilter = 'all' | 'purchased' | 'not_purchased';

export const PURCHASE_STATUS_FILTERS: PurchaseStatusFilter[] = ['all', 'purchased', 'not_purchased'];
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export interface ListPurchasableOrdersDto {
    page?: number;
    limit?: number;
    search?: string;
    purchase_status?: PurchaseStatusFilter;
}