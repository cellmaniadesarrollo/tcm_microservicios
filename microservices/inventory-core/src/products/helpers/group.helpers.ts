/** Agrupa una lista en un Map por la clave que devuelve `keyFn`. */
export function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
    const map = new Map<K, T[]>();
    for (const item of items) {
        const key = keyFn(item);
        const list = map.get(key);
        if (list) list.push(item);
        else map.set(key, [item]);
    }
    return map;
}

/** Indexa una lista en un Map por la clave que devuelve `keyFn` (si hay repetidas, gana la última). */
export function indexBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T> {
    return new Map(items.map((item) => [keyFn(item), item] as [K, T]));
}

/** Recorta una lista a `max` filas e indica si había más (las queries piden max + 1). */
export function truncate<T>(rows: T[], max: number): { items: T[]; truncated: boolean } {
    const truncated = rows.length > max;
    return { items: truncated ? rows.slice(0, max) : rows, truncated };
}