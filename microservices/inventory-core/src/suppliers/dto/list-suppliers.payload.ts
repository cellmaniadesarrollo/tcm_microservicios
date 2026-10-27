import { IdentificationType } from '../enums/supplier.enums';

export interface ListSuppliersPayload {
    page?: number;
    limit?: number;
    search?: string;
    status?: boolean;
    identificationType?: IdentificationType;
    countryId?: string;
    sortBy?: 'createdAt' | 'code' | 'name' | 'identification';
    sortDir?: 'ASC' | 'DESC';
}