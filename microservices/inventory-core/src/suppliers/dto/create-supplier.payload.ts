import { IdentificationType } from '../enums/supplier.enums';

export interface CreateSupplierPayload {
    identificationType: IdentificationType;
    identificationNumber: string;
    businessName: string;
    tradeName?: string;
    countryId: string;
    address: string;
    phone?: string;
    email?: string;
}