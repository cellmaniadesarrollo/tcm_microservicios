/**
 * Convierte un rango de fechas locales a objetos Date en UTC,
 * considerando America/Guayaquil (UTC-5, offset fijo sin DST).
 *
 * Soporta dos formatos de entrada:
 *   - 'YYYY-MM-DD'            → se interpreta como día local en UTC-5
 *   - ISO 8601 con hora/Z     → se usa directamente como UTC, extrayendo solo la fecha
 *
 * Ejemplos:
 *   '2026-05-21'                  → from: 2026-05-21T05:00:00.000Z  to: 2026-05-22T04:59:59.999Z
 *   '2026-05-20T05:00:00.000Z'    → from: 2026-05-21T05:00:00.000Z  to: 2026-05-22T04:59:59.999Z
 *                                    (05:00Z = medianoche Guayaquil → día 21 local)
 */

// Guayaquil no tiene DST: offset fijo UTC-5
const OFFSET_MS = 5 * 60 * 60 * 1000; // 18_000_000 ms

/**
 * Extrae la fecha local en Guayaquil (YYYY-MM-DD) desde cualquier formato soportado.
 * Si el string ya es YYYY-MM-DD lo usa tal cual.
 * Si es ISO 8601, convierte a hora local restando el offset y toma la fecha resultante.
 */
function extractLocalDate(dateInput: string): { year: number; month: number; day: number } {
    const plainMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput);
    if (plainMatch) {
        return {
            year: Number(plainMatch[1]),
            month: Number(plainMatch[2]) - 1, // 0-indexed
            day: Number(plainMatch[3]),
        };
    }

    // ISO 8601: parsear como UTC y convertir a hora local restando el offset
    const utcMs = Date.parse(dateInput);
    if (isNaN(utcMs)) {
        throw new Error(
            `buildDateRangeUTC: formato de fecha no reconocido "${dateInput}". ` +
            `Se esperaba "YYYY-MM-DD" o ISO 8601.`,
        );
    }

    const localMs = utcMs - OFFSET_MS;
    const localDate = new Date(localMs);

    return {
        year: localDate.getUTCFullYear(),
        month: localDate.getUTCMonth(), // 0-indexed
        day: localDate.getUTCDate(),
    };
}

function localDayToUTC(dateInput: string, edge: 'start' | 'end'): Date {
    const { year, month, day } = extractLocalDate(dateInput);

    if (edge === 'start') {
        // 00:00:00.000 local (UTC-5)  →  +5h en UTC
        return new Date(Date.UTC(year, month, day, 5, 0, 0, 0));
    } else {
        // 23:59:59.999 local  →  día siguiente a las 04:59:59.999 UTC
        return new Date(Date.UTC(year, month, day + 1, 5, 0, 0, 0) - 1);
    }
}

// ---------------------------------------------------------------------------

export interface DateRangeUTC {
    from: Date | null;
    to: Date | null;
}

/**
 * Convierte dateFrom y dateTo a un rango UTC completo para queries.
 * Acepta null/undefined (sin límite por ese lado) o strings en formato
 * 'YYYY-MM-DD' o ISO 8601.
 *
 * @example
 * buildDateRangeUTC('2026-05-21', '2026-05-21')
 * // { from: 2026-05-21T05:00:00.000Z, to: 2026-05-22T04:59:59.999Z }
 *
 * buildDateRangeUTC('2026-05-20T05:00:00.000Z', '2026-05-20T05:00:00.000Z')
 * // { from: 2026-05-21T05:00:00.000Z, to: 2026-05-22T04:59:59.999Z }
 *
 * buildDateRangeUTC(null, null)
 * // { from: null, to: null }
 */
export function buildDateRangeUTC(
    dateFrom: string | null | undefined,
    dateTo: string | null | undefined,
): DateRangeUTC {
    return {
        from: dateFrom ? localDayToUTC(dateFrom, 'start') : null,
        to: dateTo ? localDayToUTC(dateTo, 'end') : null,
    };
}