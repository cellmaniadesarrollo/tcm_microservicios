import { ReasonOrderLink, VoucherDirection } from '../enums/stock-voucher.enums';

/** Motivos de sistema por empresa. Nombres según el legacy para que el equipo los reconozca. */
export const STOCK_MOVEMENT_REASONS_SEED: ReadonlyArray<{
    code: string;
    name: string;
    direction: VoucherDirection;
    orderLink: ReasonOrderLink;
    isReturnable: boolean;
    sortOrder: number;
}> = [
        // ── Salidas ──
        { code: 'REPARACION_DANO', name: 'REPARACION DAÑO', direction: VoucherDirection.OUT, orderLink: ReasonOrderLink.REQUIRED, isReturnable: true, sortOrder: 10 },
        { code: 'USO_LAB', name: 'USO LAB', direction: VoucherDirection.OUT, orderLink: ReasonOrderLink.FORBIDDEN, isReturnable: true, sortOrder: 20 },
        { code: 'REMANOFACTURAR', name: 'REMANOFACTURAR', direction: VoucherDirection.OUT, orderLink: ReasonOrderLink.FORBIDDEN, isReturnable: false, sortOrder: 30 },
        { code: 'RECICLAJE', name: 'RECICLAJE', direction: VoucherDirection.OUT, orderLink: ReasonOrderLink.FORBIDDEN, isReturnable: false, sortOrder: 40 },
        // ── Retornos ──
        { code: 'NO_REQUERIDO', name: 'NO REQUERIDO', direction: VoucherDirection.IN, orderLink: ReasonOrderLink.REQUIRED, isReturnable: false, sortOrder: 110 },
        { code: 'DEVOLUCION', name: 'DEVOLUCION', direction: VoucherDirection.IN, orderLink: ReasonOrderLink.FORBIDDEN, isReturnable: false, sortOrder: 120 },
    ];