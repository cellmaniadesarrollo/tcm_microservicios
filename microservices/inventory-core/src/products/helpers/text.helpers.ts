import { MAX_SEARCH_TOKENS } from '../constants/product.constants';

/** Minúsculas y sin tildes del lado de JS, para que el token coincida con `norm` en SQL. */
export const stripAccents = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Texto de búsqueda → palabras normalizadas (máximo MAX_SEARCH_TOKENS). */
export const tokenize = (search?: string): string[] =>
    stripAccents(String(search ?? ''))
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, MAX_SEARCH_TOKENS);

/** ¿El token es un entero que puede ser el código del producto? */
export const isNumericCode = (token: string) => /^\d{1,9}$/.test(token);