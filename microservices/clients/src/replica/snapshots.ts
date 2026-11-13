import { EntityManager, In } from 'typeorm';
import { Customer } from '../customers/entities/customer.entity';
import { BillingData } from '../billing/entities/billing-data.entity';

export interface CustomerSnapshot {
    id: number;
    companyId: string;
    idType: { id: number; code: string | null; name: string | null };
    idNumber: string;
    firstName: string;
    lastName: string;
    birthDate: string | null;           // AAAA-MM-DD
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

const iso = (d: Date | string) => new Date(d).toISOString();
const dateOnly = (d: Date | string | null | undefined) =>
    d ? (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10)) : null;

export async function buildCustomerSnapshots(em: EntityManager, ids: number[]): Promise<CustomerSnapshot[]> {
    if (!ids.length) return [];
    const rows = await em.find(Customer, {
        where: { id: In(ids) },
        relations: { idType: true, gender: true, contacts: { contactType: true }, addresses: { city: true } },
    });
    const byId = new Map(rows.map((c) => [c.id, c] as [number, Customer]));
    return ids.map((id) => byId.get(id)).filter((c): c is Customer => !!c).map((c) => ({
        id: c.id,
        companyId: c.company.id,
        idType: { id: c.idType.id, code: c.idType.code ?? null, name: c.idType.name ?? null },
        idNumber: c.idNumber,
        firstName: c.firstName,
        lastName: c.lastName,
        birthDate: dateOnly(c.birthDate as any),
        gender: c.gender ? { id: c.gender.id, name: c.gender.name } : null,
        isActive: c.isActive,
        contacts: (c.contacts ?? []).map((x) => ({
            id: x.id,
            type: x.contactType?.name ?? 'OTHER',
            // la BD guarda todo en mayúsculas (Contact.normalizeFields): el correo se normaliza aquí
            value: x.contactType?.name === 'EMAIL' ? x.value.toLowerCase() : x.value,
            isPrimary: x.isPrimary,
        })),
        addresses: (c.addresses ?? []).map((a) => ({
            id: a.id, cityId: a.city?.id ?? null, city: a.city?.name ?? null,
            zone: a.zone ?? null, sector: a.sector ?? null, locality: a.locality ?? null,
            mainStreet: a.mainStreet ?? null, secondaryStreet: a.secondaryStreet ?? null,
            reference: a.reference ?? null, postalCode: a.postalCode ?? null,
        })),
        createdAt: iso(c.createdAt),
        updatedAt: iso(c.updatedAt),
    }));
}

export async function buildBillingSnapshots(em: EntityManager, ids: string[]): Promise<BillingSnapshot[]> {
    if (!ids.length) return [];
    const rows = await em.find(BillingData, {
        where: { id: In(ids) },
        relations: { idType: true, personType: true, gender: true, cityRef: true },
    });
    // Vínculos con clientes (nombres de columna por defecto de TypeORM: (verificar))
    const links: Array<{ bid: string; cid: number }> = await em.query(
        `SELECT "billingDataId" AS bid, "customerId" AS cid FROM customer_billing_data WHERE "billingDataId" = ANY($1)`,
        [ids],
    );
    const customersByBilling = new Map<string, number[]>();
    for (const l of links) {
        const list = customersByBilling.get(l.bid) ?? [];
        list.push(Number(l.cid));
        customersByBilling.set(l.bid, list);
    }
    const byId = new Map(rows.map((b) => [b.id, b] as [string, BillingData]));
    return ids.map((id) => byId.get(id)).filter((b): b is BillingData => !!b).map((b) => ({
        id: b.id,
        companyId: b.company.id,
        idType: { id: b.idType.id, code: b.idType.code ?? null, name: b.idType.name ?? null },
        idNumber: b.idNumber,
        personType: { id: b.personType.id, name: b.personType.name },
        gender: b.gender ? { id: b.gender.id, name: b.gender.name } : null,
        firstName: b.firstName,
        lastName: b.lastName ?? null,
        tradeName: b.tradeName ?? null,
        mainEmail: b.mainEmail,
        cellphone: b.cellphone ?? null,
        phone: b.phone ?? null,
        birthdate: dateOnly(b.birthdate),
        address: b.address,
        city: b.city ?? null,
        cityId: b.cityRef?.id ?? null,
        isCompanyClient: b.isCompanyClient,
        isActive: b.isActive,
        customerIds: (customersByBilling.get(b.id) ?? []).sort((x, y) => x - y),
        createdAt: iso(b.createdAt),
        updatedAt: iso(b.updatedAt),
    }));
}