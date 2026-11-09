import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, ILike, Not } from 'typeorm';
import { parseAccessKey } from './helpers/access-key.helper';
import { RpcException } from '@nestjs/microservices';
import { Receipt } from '../receipts/entities/receipt.entity';
import { ReceiptStatus } from '../receipts/enums/receipt.enums';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { IdentificationType } from '../suppliers/enums/supplier.enums';
import { SriClientService, SriUnavailableError } from './sri-client.service';
import { InvoiceHeader, parseInvoiceHeader, InvoiceLine, parseInvoiceLines } from './invoice-parser';
import { Country } from '../catalogs/entities/country.entity';
import { ProductsService } from '../products/products.service';

const IDENTIFICATION_TYPE_LABELS: Record<IdentificationType, string> = {
    [IdentificationType.RUC]: 'RUC',
    [IdentificationType.CEDULA]: 'Cédula',
    [IdentificationType.PASSPORT]: 'Pasaporte',
    [IdentificationType.FOREIGN_ID]: 'Identificación extranjera',
};

@Injectable()
export class SriService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly client: SriClientService,
        private readonly products: ProductsService
    ) { }

    async previewAccessKey(rawKey: unknown, companyId: string) {
        const parsed = parseAccessKey(rawKey);
        if (!parsed.ok) throw new RpcException(new BadRequestException(parsed.error));
        const k = parsed.value;

        const em = this.dataSource.manager;
        const [existing, supplier] = await Promise.all([
            // Los anulados no cuentan: la clave se puede volver a importar
            em.findOne(Receipt, {
                where: { companyId, accessKey: k.accessKey, status: Not(ReceiptStatus.VOIDED) },
                select: { id: true, code: true, status: true, issueDate: true },
            }),
            em.findOne(Supplier, {
                where: { companyId, identificationType: IdentificationType.RUC, identificationNumber: k.issuerRuc },
                select: {
                    id: true, code: true, identificationType: true, identificationNumber: true,
                    businessName: true, tradeName: true, status: true,
                },
            }),
        ]);

        const warnings: string[] = [];
        if (k.environment === 'TEST') warnings.push('La clave es del ambiente de pruebas del SRI: no corresponde a una factura real');
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
        if (k.issueDate > today) warnings.push('La fecha de emisión de la clave es futura');
        if (supplier && !supplier.status) warnings.push('El proveedor existe pero está inactivo');

        // ───── SRI: solo si se puede importar (ahorra una llamada externa) ─────
        let sri: {
            available: boolean;
            state: string | null;
            authorizationNumber: string | null;
            authorizationDate: string | null;
            message: string | null;
        } = { available: false, state: null, authorizationNumber: null, authorizationDate: null, message: null };
        let header: InvoiceHeader | null = null;
        let lines: InvoiceLine[] = [];

        if (!existing) {
            try {
                const auth = await this.client.fetchAuthorization(k.accessKey, k.environment);
                sri = {
                    available: true,
                    state: auth.state,
                    authorizationNumber: auth.authorizationNumber,
                    authorizationDate: auth.authorizationDate,
                    message: auth.messages[0] ?? null,
                };

                if (auth.state === 'NOT_FOUND') warnings.push('El SRI no tiene registrada esta clave de acceso');
                else if (auth.state === 'NOT_AUTHORIZED') warnings.push('El SRI indica que el comprobante no está autorizado');

                if (auth.xml) {
                    header = parseInvoiceHeader(this.client.parser, auth.xml);
                    if (!header) warnings.push('No se pudieron leer los datos del comprobante');
                    else if (header.issuer.ruc !== k.issuerRuc) {
                        warnings.push('El RUC del comprobante no coincide con el de la clave de acceso');
                        header = null; // no se confía en datos que no cuadran
                    } else {
                        lines = parseInvoiceLines(this.client.parser, auth.xml);
                        if (!lines.length) warnings.push('El comprobante no trae líneas de detalle');
                    }
                }
            } catch (error) {
                if (!(error instanceof SriUnavailableError)) throw error;
                sri.message = 'No se pudo consultar al SRI. Puedes llenar el ingreso manualmente.';
                warnings.push(sri.message);
            }
        }

        // ───── Proveedor: existente (con id) o borrador para crearlo ─────
        let supplierDraft: Record<string, unknown> | null = null;
        let supplierForm: Record<string, unknown> | null = null;

        if (!supplier && !existing) {
            const ecuador = await em.findOne(Country, { where: { name: ILike('ecuador') }, select: { id: true } });

            supplierDraft = {
                identificationType: IdentificationType.RUC,
                identificationNumber: k.issuerRuc,
                businessName: header?.issuer.businessName.slice(0, 200) ?? null,
                tradeName: header?.issuer.tradeName?.slice(0, 200) ?? null,
                address: header?.issuer.address?.slice(0, 255) ?? null,
                countryId: ecuador?.id ?? null,
                phone: null,
                email: null,
                source: header ? 'SRI' : 'ACCESS_KEY', // de dónde salieron los datos
            };

            const countries = await em.find(Country, { select: { id: true, name: true }, order: { name: 'ASC' } });
            supplierForm = {
                identificationTypes: Object.values(IdentificationType).map((value) => ({
                    value,
                    label: IDENTIFICATION_TYPE_LABELS[value],
                })),
                countries: countries.map((c) => ({ id: c.id, name: c.name })),
            };
        }

        const matchedLines = await this.matchLines(companyId, supplier?.id ?? null, lines);

        return {
            canImport: !existing,
            key: {
                accessKey: k.accessKey,
                issueDate: header?.issueDate ?? k.issueDate,
                documentType: k.documentType,
                documentNumber: header?.documentNumber ?? k.documentNumber,
                issuerRuc: k.issuerRuc,
                environment: k.environment,
            },
            existingReceipt: existing
                ? { id: existing.id, code: existing.code, status: existing.status, issueDate: existing.issueDate }
                : null,
            supplier: supplier
                ? {
                    id: supplier.id,
                    code: supplier.code,
                    identificationType: supplier.identificationType,
                    identificationNumber: supplier.identificationNumber,
                    businessName: supplier.businessName,
                    tradeName: supplier.tradeName ?? null,
                    status: supplier.status,
                }
                : null,
            supplierDraft,
            supplierForm,
            sri,
            warnings,
            lines: matchedLines,
            documentTotals: header?.totals ?? null,
        };
    }

    private async matchLines(companyId: string, supplierId: string | null, lines: InvoiceLine[]) {
        if (!lines.length) return [];
        const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

        // 1. Mapeos del proveedor para los códigos de esta factura
        const codes = [...new Set(lines.map((l) => l.code).filter((c): c is string => !!c))];
        const mappings: any[] = supplierId && codes.length
            ? await this.dataSource.query(
                `SELECT sc.id, sc.code, sc.unit_factor AS "unitFactor", sc.product_id AS "productId", p.status
             FROM supplier_product_codes sc
             JOIN products p ON p.id = sc.product_id
             WHERE sc.company_id = $1 AND sc.supplier_id = $2 AND sc.code = ANY($3)`,
                [companyId, supplierId, codes],
            )
            : [];
        const mappingByCode = new Map<string, any>(mappings.map((m) => [m.code, m] as [string, any]));

        // 2. Items con la MISMA forma que products/search (modelos, defaults, último ingreso, códigos)
        const items = await this.products.findReceiptItemsByIds(
            mappings.filter((m) => m.status).map((m) => m.productId),
            companyId,
            supplierId ?? undefined,
        );

        // 3. Resultado por línea
        return lines.map((l) => {
            const base = {
                lineNo: l.lineNo,
                supplierCode: l.code,
                auxiliaryCode: l.auxiliaryCode,
                description: l.description,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                discount: l.discount,
                subtotal: l.subtotal,
                tax: l.tax,
            };
            const unmapped = (reason: string, mapping: any = null) =>
                ({ ...base, match: { status: 'UNMAPPED', reason, mapping, product: null, suggestion: null } });

            const m = l.code ? mappingByCode.get(l.code) : undefined;
            if (!m) return unmapped(l.code ? 'NO_MAPPING' : 'NO_CODE');

            const product = items.get(m.productId);
            if (!m.status || !product) return unmapped('PRODUCT_INACTIVE', { id: m.id, unitFactor: m.unitFactor });

            const factor = Number(m.unitFactor) || 1;
            const qty = round4(l.quantity * factor);

            return {
                ...base,
                match: {
                    status: 'MAPPED',
                    reason: null,
                    mapping: { id: m.id, unitFactor: m.unitFactor },
                    product, // idéntico a un item de products/search
                    suggestion: {
                        quantity: Number.isInteger(qty) ? qty : null, // null si el factor no da un entero
                        unitCost: round4(l.unitPrice / factor),
                    },
                },
            };
        });
    }
}