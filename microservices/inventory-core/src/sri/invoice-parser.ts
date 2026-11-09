import { XMLParser } from 'fast-xml-parser';

export interface InvoiceHeader {
    issuer: {
        ruc: string;
        businessName: string;
        tradeName: string | null;
        address: string | null;
    };
    issueDate: string | null;      // AAAA-MM-DD
    documentNumber: string | null;
    buyer: { identification: string | null; name: string | null };
    totals: { subtotal: string | null; discount: string | null; total: string | null };
}

const text = (v: unknown): string | null => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s || null;
};

/** El SRI usa dd/mm/aaaa. */
const toIsoDate = (v: unknown): string | null => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v ?? ''));
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

export function parseInvoiceHeader(parser: XMLParser, xml: string): InvoiceHeader | null {
    let factura: any;
    try {
        factura = parser.parse(xml)?.factura;
    } catch {
        return null;
    }
    const t = factura?.infoTributaria;
    const f = factura?.infoFactura;
    if (!t?.ruc || !t?.razonSocial) return null;

    return {
        issuer: {
            ruc: String(t.ruc),
            businessName: String(t.razonSocial),
            tradeName: text(t.nombreComercial),
            address: text(f?.dirEstablecimiento) ?? text(t.dirMatriz),
        },
        issueDate: toIsoDate(f?.fechaEmision),
        documentNumber: t.estab && t.ptoEmi && t.secuencial ? `${t.estab}-${t.ptoEmi}-${t.secuencial}` : null,
        buyer: { identification: text(f?.identificacionComprador), name: text(f?.razonSocialComprador) },
        totals: {
            subtotal: text(f?.totalSinImpuestos),
            discount: text(f?.totalDescuento),
            total: text(f?.importeTotal),
        },
    };




}

export interface InvoiceLine {
    lineNo: number;
    /** Código principal (o interno/auxiliar si no hay), normalizado. Es la clave del mapeo. */
    code: string | null;
    auxiliaryCode: string | null;
    description: string;
    quantity: number;
    unitPrice: number;      // hasta 6 decimales en el XML
    discount: number;       // descuento TOTAL de la línea
    subtotal: number;       // sin impuesto y con descuento
    tax: { code: string | null; rate: number | null };
}

const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
const normCode = (v: unknown): string | null => {
    const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
    return s ? s.slice(0, 100) : null;
};

export function parseInvoiceLines(parser: XMLParser, xml: string): InvoiceLine[] {
    let details: any[];
    try {
        const raw = parser.parse(xml)?.factura?.detalles?.detalle;
        details = Array.isArray(raw) ? raw : raw ? [raw] : [];
    } catch {
        return [];
    }

    return details.map((d, i) => {
        // Se prefiere el IVA (código 2); si no hay, el primer impuesto de la línea
        const taxes: any[] = Array.isArray(d.impuestos?.impuesto) ? d.impuestos.impuesto : [];
        const t = taxes.find((x) => String(x.codigo) === '2') ?? taxes[0];

        return {
            lineNo: i + 1,
            code: normCode(d.codigoPrincipal) ?? normCode(d.codigoInterno) ?? normCode(d.codigoAuxiliar),
            auxiliaryCode: normCode(d.codigoAuxiliar),
            description: String(d.descripcion ?? '').trim().slice(0, 300),
            quantity: num(d.cantidad),
            unitPrice: num(d.precioUnitario),
            discount: num(d.descuento),
            subtotal: num(d.precioTotalSinImpuesto),
            // codigoPorcentaje es el que se guarda como purchaseTaxCode (ej. "4" = 15%)
            tax: { code: t?.codigoPorcentaje != null ? String(t.codigoPorcentaje).slice(0, 10) : null, rate: t?.tarifa != null ? num(t.tarifa) : null },
        };
    });
}