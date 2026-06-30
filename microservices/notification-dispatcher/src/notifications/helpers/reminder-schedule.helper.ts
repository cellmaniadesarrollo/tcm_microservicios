// ── Patrón de intervalos de recordatorio (en días) ───────────────────────────
// Día acumulado: 1 → 4 → 7 → 15 → 30 → 45 → 60 → 75 → 90 (fin)
export const REMINDER_INTERVALS = [1, 3, 3, 8, 15, 15, 15, 15, 15] as const;
export const LAST_REMINDER_STEP = REMINDER_INTERVALS.length - 1; // 8
export const MAX_DAYS_FROM_START = 90;

export function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}