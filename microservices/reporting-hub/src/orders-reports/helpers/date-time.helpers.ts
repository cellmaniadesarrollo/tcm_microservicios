// ─── Zona horaria ─────────────────────────────────────────────────────────────
export const TZ = 'America/Guayaquil';
const ECUADOR_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC-5, sin DST

// ─── Primitivas UTC ───────────────────────────────────────────────────────────

/**
 * Medianoche en hora local Ecuador → UTC equivalente.
 * Ecuador = UTC-5 fijo → offset siempre +5 h sobre la medianoche local.
 */
export function _midnightUTC(year: number, month: number, day: number): Date {
    const localMidnightMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    return new Date(localMidnightMs + ECUADOR_OFFSET_MS);
}

/**
 * Fin de día: medianoche del día siguiente − 1 ms → 23:59:59.999 hora local.
 */
export function _endOfDayUTC(year: number, month: number, day: number): Date {
    const next = _midnightUTC(year, month, day + 1); // JS normaliza desbordamiento
    return new Date(next.getTime() - 1);
}

// ─── "Ahora" en la zona horaria ───────────────────────────────────────────────

export function _nowInTZ(): { year: number; month: number; day: number; weekday: number } {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
    }).formatToParts(now);

    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';

    const year = parseInt(get('year'), 10);
    const month = parseInt(get('month'), 10); // 1-12
    const day = parseInt(get('day'), 10);

    const SHORT_DAY: Record<string, number> = {
        Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const weekday = SHORT_DAY[get('weekday')] ?? 0;

    return { year, month, day, weekday };
}

// ─── Límites de períodos ──────────────────────────────────────────────────────

/**
 * Inicio y fin del "día" usando corte a las 03:00 GYE.
 * Si son las 02:30, el "día actual" es el de ayer (período 03:00 ayer → 03:00 hoy).
 */
export function _dayBoundaries(): { todayStart: Date; todayEnd: Date } {
    const GYE_OFFSET_MS = -5 * 60 * 60 * 1000;

    const nowUTC = new Date();
    const nowLocal = new Date(nowUTC.getTime() + GYE_OFFSET_MS);

    const cutHour = 3;
    const base = new Date(nowLocal);
    if (nowLocal.getHours() < cutHour) {
        base.setDate(base.getDate() - 1);
    }
    base.setHours(cutHour, 0, 0, 0);

    const todayStart = new Date(base.getTime() - GYE_OFFSET_MS);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    return { todayStart, todayEnd };
}

/**
 * Lunes y domingo de la semana actual en UTC, más el lunes en hora local
 * (necesario para generar las keys del byDay).
 */
export function _currentWeekBoundaries(): {
    currentMondayUTC: Date;
    currentSundayUTC: Date;
    currentMondayLocal: Date;
} {
    const { year, month, day, weekday } = _nowInTZ();

    const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
    const mondayDay = day - daysFromMonday;

    const currentMondayUTC = _midnightUTC(year, month, mondayDay);
    const currentSundayUTC = _midnightUTC(year, month, mondayDay + 7); // $lt
    const currentMondayLocal = new Date(Date.UTC(year, month - 1, mondayDay));

    return { currentMondayUTC, currentSundayUTC, currentMondayLocal };
}

/**
 * Lunes y domingo de la semana ANTERIOR en UTC + lunes local.
 */
export function _lastWeekBoundaries(): {
    lastMondayUTC: Date;
    lastSundayUTC: Date;
    lastMondayLocal: Date;
} {
    const GYE_OFFSET_MS = -5 * 60 * 60 * 1000;
    const CUT_HOUR = 3;

    const nowLocal = new Date(new Date().getTime() + GYE_OFFSET_MS);
    const baseLocal = new Date(nowLocal);
    if (nowLocal.getHours() < CUT_HOUR) baseLocal.setDate(baseLocal.getDate() - 1);
    baseLocal.setHours(CUT_HOUR, 0, 0, 0);

    const dow = baseLocal.getDay() === 0 ? 7 : baseLocal.getDay(); // 1=Lun … 7=Dom
    const lastMondayLocal = new Date(baseLocal);
    lastMondayLocal.setDate(baseLocal.getDate() - dow - 6);

    const lastSundayLocal = new Date(lastMondayLocal);
    lastSundayLocal.setDate(lastMondayLocal.getDate() + 7);

    return {
        lastMondayUTC: new Date(lastMondayLocal.getTime() - GYE_OFFSET_MS),
        lastSundayUTC: new Date(lastSundayLocal.getTime() - GYE_OFFSET_MS),
        lastMondayLocal,
    };
}

/**
 * Primer y último instante del mes actual en UTC.
 */
export function _monthBoundaries(): { monthStart: Date; monthEnd: Date } {
    const { year, month } = _nowInTZ();

    const monthStart = _midnightUTC(year, month, 1);

    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const monthEnd = _midnightUTC(nextYear, nextMonth, 1); // $lt

    return { monthStart, monthEnd };
}

// ─── Helpers de rango con corte GYE ───────────────────────────────────────────

/**
 * 'YYYY-MM-DD' → inicio del día en hora GYE (03:00 GYE == 08:00 UTC).
 */
export function _gyeDayStart(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 8, 0, 0, 0));
}

/**
 * 'YYYY-MM-DD' → inicio del día SIGUIENTE en hora GYE.
 * Así el día `to` queda completamente incluido en el rango.
 */
export function _gyeDayEnd(dateStr: string): Date {
    const start = _gyeDayStart(dateStr);
    return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}