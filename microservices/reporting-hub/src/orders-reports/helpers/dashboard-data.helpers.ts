export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Construye el array de 7 días de una semana, rellenando con ceros
 * los días sin datos.
 *
 * @param mondayLocal  Lunes de la semana en hora local (Date.UTC con coords locales)
 * @param rawData      Registros del aggregation con _id = 'YYYY-MM-DD'
 */
export function buildWeekDays(
    mondayLocal: Date,
    rawData: Array<{ _id: string; ingresadas?: number; entregadas?: number; cobros?: number }>,
) {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(mondayLocal);
        d.setDate(mondayLocal.getDate() + i);
        const key = d.toISOString().split('T')[0];
        const found = rawData.find(r => r._id === key);
        return {
            date: key,
            dayName: DAY_NAMES[d.getDay()],
            ingresadas: found?.ingresadas ?? 0,
            entregadas: found?.entregadas ?? 0,
            cobros: found?.cobros ?? 0,
        };
    });
}