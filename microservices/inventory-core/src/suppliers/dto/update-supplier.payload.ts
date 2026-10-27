export interface UpdateSupplierPayload {
    businessName?: string;
    tradeName?: string | null;
    countryId?: string;
    address?: string;
    phone?: string | null;
    email?: string | null;
}