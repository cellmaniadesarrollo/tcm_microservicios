export interface GatewayUserPayload {
    userId: number;
    companyId: number;
    branchId?: number;
}

/**
 * Normaliza el objeto `user` que llega del JWT (con `sub`, `companyId`, `branchId`)
 * al shape que consumen los microservicios.
 * Evita repetir `{ userId: user.sub, companyId: user.companyId, branchId: user.branchId }`
 * en cada endpoint del controller.
 */
export function toUserPayload(user: any): GatewayUserPayload {
    return {
        userId: user.sub ?? user.userId,
        companyId: user.companyId,
        branchId: user.branchId,
    };
}