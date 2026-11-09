/** Minúsculas y sin tildes en SQL (sin depender de la extensión unaccent). */
export const norm = (expr: string) => `translate(lower(${expr}), 'áéíóúüñ', 'aeiouun')`;

/** Lo mismo del lado de JS, para que el token coincida con `norm`. */
export const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Escapa los comodines de LIKE para que "50%" o "a_13" se busquen literalmente. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/** Parte el texto en palabras normalizadas (sin repetidas). */
export const toTokens = (search: unknown, max = 6): string[] =>
    [...new Set(stripAccents(String(search ?? '')).split(/\s+/).filter(Boolean))].slice(0, max);