import { CancellationStatus } from '../entities/spare-cancellation-request.entity';

export type SpareCancellationSortBy = 'createdAt' | 'orderNumber' | 'productName' | 'sku';
export type SpareCancellationStatusFilter = CancellationStatus | 'ALL';

export interface ListSpareCancellationsQuery {
    page?: number | string;
    limit?: number | string;
    /** Por defecto PENDING (la bandeja de bodega). */
    status?: SpareCancellationStatusFilter;
    search?: string;
    sortBy?: SpareCancellationSortBy;
    sortDir?: 'ASC' | 'DESC';
    includeFilters?: boolean | string;
}