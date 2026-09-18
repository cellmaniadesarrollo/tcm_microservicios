// src/invoices/utils/decimal.util.ts
type MongoDecimal = { $numberDecimal: string };

export function extractDecimal(value: number | string | MongoDecimal | null | undefined): number | null {
    if (value === null || value === undefined) return null;

    if (typeof value === 'number') return value;

    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? null : parsed;
    }

    if (typeof value === 'object' && '$numberDecimal' in value) {
        const parsed = parseFloat(value.$numberDecimal);
        return isNaN(parsed) ? null : parsed;
    }

    return null;
}