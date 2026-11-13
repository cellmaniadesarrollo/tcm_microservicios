export interface CustomerSnapshot {
    id: number;
    companyId: string;
    idType: { id: number; code: string | null; name: string | null };
    idNumber: string;
    firstName: string;
    lastName: string;
    birthDate: string | null;
    gender: { id: number; name: string } | null;
    isActive: boolean;
    contacts: Array<{ id: number; type: string; value: string; isPrimary: boolean }>;
    addresses: Array<{
        id: number; cityId: number | null; city: string | null; zone: string | null; sector: string | null;
        locality: string | null; mainStreet: string | null; secondaryStreet: string | null;
        reference: string | null; postalCode: string | null;
    }>;
    createdAt: string;
    updatedAt: string;
}

export interface BillingSnapshot {
    id: string;
    companyId: string;
    idType: { id: number; code: string | null; name: string | null };
    idNumber: string;
    personType: { id: number; name: string };
    gender: { id: number; name: string } | null;
    firstName: string;
    lastName: string | null;
    tradeName: string | null;
    mainEmail: string;
    cellphone: string | null;
    phone: string | null;
    birthdate: string | null;
    address: string;
    city: string | null;
    cityId: number | null;
    isCompanyClient: boolean;
    isActive: boolean;
    customerIds: number[];
    createdAt: string;
    updatedAt: string;
}