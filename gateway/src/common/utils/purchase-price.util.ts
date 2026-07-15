// common/utils/purchase-price.util.ts
const ADMIN_GROUPS = ['COMPANY_ADMIN', 'ADMINS'];
const PURCHASE_PRICE_GROUPS = ['COMPRADOR', ...ADMIN_GROUPS];

export function canManagePurchasePrice(userGroups: string[] = []): boolean {
    return userGroups.some((g) => PURCHASE_PRICE_GROUPS.includes(g));
}

export function stripPurchasePriceIfNotAllowed<T extends { purchase_price?: any }>(
    dto: T,
    userGroups: string[] = [],
): T {
    if (!canManagePurchasePrice(userGroups)) {
        const { purchase_price, ...rest } = dto;
        return rest as T;
    }
    return dto;
}