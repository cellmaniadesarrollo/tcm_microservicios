// src/whatsapp/helpers/whatsapp.helpers.ts

/**
 * Normaliza un número de teléfono al formato E.164 para Ecuador (593).
 * Elimina caracteres no numéricos y corrige prefijos locales.
 */
export function normalizePhone(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '593' + digits.slice(1);
    if (digits.startsWith('5930')) digits = '593' + digits.slice(4);
    return digits;
}

/**
 * Convierte un número de teléfono al JID de WhatsApp.
 * Si ya contiene '@' se devuelve tal cual.
 */
export function toJid(phone: string): string {
    const normalized = normalizePhone(phone);
    return normalized.includes('@') ? normalized : `${normalized}@s.whatsapp.net`;
}

/**
 * Retorna una promesa que resuelve tras un delay aleatorio
 * entre `minMs` y `maxMs` milisegundos.
 */
export function randomDelay(minMs: number, maxMs: number): Promise<void> {
    const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * Retorna una promesa que rechaza tras `timeoutMs` milisegundos
 * con el mensaje indicado. Útil para `Promise.race`.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(message)), timeoutMs),
    );
    return Promise.race([promise, timeout]);
}