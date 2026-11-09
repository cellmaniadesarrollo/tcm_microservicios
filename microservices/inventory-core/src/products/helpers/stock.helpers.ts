import { StockStatus } from '../types/product-list.types';

export const deriveStockStatus = (available: number, minStock: number): StockStatus =>
    available <= 0 ? 'OUT' : available <= minStock ? 'LOW' : 'OK';