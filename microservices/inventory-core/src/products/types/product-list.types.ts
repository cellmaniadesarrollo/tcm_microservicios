import { ProductKind } from '../../common/enums/product-kind.enum';
import { TrackingMode } from '../enums/product.enums';

export type ProductSortBy = 'createdAt' | 'code' | 'sku' | 'name' | 'basePrice' | 'stock';
export type StockStatus = 'OUT' | 'LOW' | 'OK';

export interface ListProductsQuery {
    page?: number;
    limit?: number;
    search?: string;
    productTypeId?: string;
    kind?: ProductKind;
    usageId?: string;
    qualityId?: string;
    trackingMode?: TrackingMode;
    stockStatus?: StockStatus;
    includeFilters?: boolean | string;
    sortBy?: ProductSortBy;
    sortDir?: 'ASC' | 'DESC';
}