import { BadRequestException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { MAX_PRICE } from '../constants/product.constants';
import { TrackingMode } from '../enums/product.enums';

const bad = (msg: string) => new RpcException(new BadRequestException(msg));
const isSet = (v: unknown) => v !== undefined && v !== null;

/**
 * Valida números y enums del DTO también en este servicio (llega por RPC y no
 * se debe confiar en que el gateway ya lo hizo). Solo revisa lo que viene definido.
 */
export function assertValidDto(dto: any): void {
    for (const [key, label] of [
        ['minStock', 'El stock mínimo'],
        ['warrantyDays', 'La garantía'],
    ] as const) {
        if (isSet(dto[key]) && (!Number.isInteger(Number(dto[key])) || Number(dto[key]) < 0)) {
            throw bad(`${label} debe ser un entero mayor o igual a 0`);
        }
    }

    if (isSet(dto.basePrice)) {
        const price = Number(dto.basePrice);
        if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE) {
            throw bad('El precio base debe ser un número mayor o igual a 0');
        }
    }

    for (const key of ['hasTax', 'priceIncludesTax', 'billableInSales', 'billableInRepairOrders'] as const) {
        if (isSet(dto[key]) && typeof dto[key] !== 'boolean') {
            throw bad(`${key} debe ser verdadero o falso`);
        }
    }

    if (isSet(dto.trackingMode) && !Object.values(TrackingMode).includes(dto.trackingMode)) {
        throw bad('El modo de seguimiento no es válido');
    }
}

/** Regla: facturable en órdenes de reparación exige facturable en ventas. */
export function assertBillingConsistency(billableInSales: boolean, billableInRepairOrders: boolean): void {
    if (billableInRepairOrders && !billableInSales) {
        throw bad('Un producto facturable en órdenes de reparación también debe ser facturable en ventas');
    }
}