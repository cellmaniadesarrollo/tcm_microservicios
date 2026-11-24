export const APPROVAL_TTL_MS = 5 * 60 * 1000;   // tiempo para aprobar
export const USAGE_TTL_MS = 15 * 60 * 1000;     // tiempo para crear el cliente tras aprobar

export const sessionUserId = (user: any): string =>
    String(user?.sub ?? user?.userId ?? user?.id ?? '');