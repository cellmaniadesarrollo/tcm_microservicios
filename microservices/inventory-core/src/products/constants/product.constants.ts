import { AVAILABLE_SQL } from '../helpers/sql.helpers';
import { ProductSortBy, StockStatus } from '../types/product-list.types';

// Límites del detalle
export const DETAIL_MAX_LOTS = 50;
export const DETAIL_MAX_UNITS = 200;
export const DETAIL_MAX_MOVEMENTS = 30;

// Listado y búsqueda
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_SEARCH_TOKENS = 6;

/** numeric(12,2) admite hasta 9999999999.99 */
export const MAX_PRICE = 9_999_999_999.99;

/** Prefijo del SKU según el kind del tipo. */
export const KIND_PREFIX: Record<string, string> = {
    PART: 'REP',
    ACCESSORY: 'ACC',
    DEVICE: 'EQP',
};

export const SORT_COLUMNS: Record<ProductSortBy, string> = {
    createdAt: 'p.createdAt',
    code: 'p.code',
    sku: 'p.sku',
    name: 'pn.name',
    basePrice: 'p.basePrice',
    stock: AVAILABLE_SQL,
};

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
    OUT: 'Sin stock',
    LOW: 'Stock bajo',
    OK: 'Con stock',
};