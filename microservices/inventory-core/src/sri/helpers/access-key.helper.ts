export const DOCUMENT_TYPES: Record<string, string> = {
    '01': 'FACTURA',
    '03': 'LIQUIDACION_COMPRA',
    '04': 'NOTA_CREDITO',
    '05': 'NOTA_DEBITO',
    '06': 'GUIA_REMISION',
    '07': 'RETENCION',
};

export interface AccessKeyInfo {
    accessKey: string;
    issueDate: string;            // AAAA-MM-DD
    documentTypeCode: string;     // '01'
    documentType: string;         // 'FACTURA'
    issuerRuc: string;
    environment: 'TEST' | 'PRODUCTION';
    establishment: string;        // '001'
    emissionPoint: string;        // '001'
    sequential: string;           // '000123456'
    documentNumber: string;       // '001-001-000123456'
    emissionType: string;
}

export type ParseResult = { ok: true; value: AccessKeyInfo } | { ok: false; error: string };

/** Dígito verificador: módulo 11 con pesos 2..7 de derecha a izquierda. */
export function checkDigit(first48: string): number {
    let sum = 0;
    let weight = 2;
    for (let i = first48.length - 1; i >= 0; i--) {
        sum += Number(first48[i]) * weight;
        weight = weight === 7 ? 2 : weight + 1;
    }
    const r = 11 - (sum % 11);
    return r === 11 ? 0 : r === 10 ? 1 : r;
}

/** Acepta la clave con espacios o guiones (como se copia de un PDF). */
export const normalizeAccessKey = (raw: unknown) => String(raw ?? '').replace(/[\s-]/g, '');

export function parseAccessKey(raw: unknown): ParseResult {
    const key = normalizeAccessKey(raw);
    if (!/^\d{49}$/.test(key)) return { ok: false, error: 'La clave de acceso debe tener 49 dígitos' };

    if (checkDigit(key.slice(0, 48)) !== Number(key[48])) {
        return { ok: false, error: 'La clave de acceso no es válida (dígito verificador incorrecto)' };
    }

    const dd = key.slice(0, 2), mm = key.slice(2, 4), yyyy = key.slice(4, 8);
    const issueDate = `${yyyy}-${mm}-${dd}`;
    const d = new Date(`${issueDate}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== issueDate) {
        return { ok: false, error: 'La fecha dentro de la clave de acceso no es válida' };
    }

    const typeCode = key.slice(8, 10);
    if (typeCode !== '01') {
        const name = DOCUMENT_TYPES[typeCode];
        return {
            ok: false,
            error: name
                ? `Solo se admiten facturas; esta clave corresponde a: ${name.replace('_', ' ').toLowerCase()}`
                : 'El tipo de comprobante de la clave no es válido',
        };
    }

    const establishment = key.slice(24, 27);
    const emissionPoint = key.slice(27, 30);
    const sequential = key.slice(30, 39);

    return {
        ok: true,
        value: {
            accessKey: key,
            issueDate,
            documentTypeCode: typeCode,
            documentType: DOCUMENT_TYPES[typeCode],
            issuerRuc: key.slice(10, 23),
            environment: key[23] === '2' ? 'PRODUCTION' : 'TEST',
            establishment,
            emissionPoint,
            sequential,
            documentNumber: `${establishment}-${emissionPoint}-${sequential}`,
            emissionType: key[47] === undefined ? '' : key.slice(47 - 0, 48),
        },
    };
}