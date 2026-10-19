/** "  Batería  SAMSUNG A-52 " → "bateria samsung a 52" */
export function normalizeNameKey(input: string): string {
    return input
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

export function cleanDisplayName(input: string): string {
    return input.trim().replace(/\s+/g, ' ');
}