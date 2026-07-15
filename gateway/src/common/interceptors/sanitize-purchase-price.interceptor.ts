// common/interceptors/sanitize-purchase-price.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { canManagePurchasePrice } from '../utils/purchase-price.util';

// Campos anidados que pueden traer purchase_price dentro (ej: al devolver la orden completa)
const NESTED_ARRAY_FIELDS = ['pendingProducts', 'extraServices'];

function sanitizeDeep(data: any): any {
    if (data === null || data === undefined || typeof data !== 'object') return data;

    if (Array.isArray(data)) {
        return data.map(sanitizeDeep);
    }

    const clone: any = { ...data };

    if ('purchase_price' in clone) {
        clone.purchase_price = null;
    }

    for (const field of NESTED_ARRAY_FIELDS) {
        if (Array.isArray(clone[field])) {
            clone[field] = clone[field].map(sanitizeDeep);
        }
    }

    return clone;
}

@Injectable()
export class SanitizePurchasePriceInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const groups: string[] = request.user?.groups ?? [];

        if (canManagePurchasePrice(groups)) {
            return next.handle(); // tiene permiso, no toca nada
        }

        return next.handle().pipe(map((data) => sanitizeDeep(data)));
    }
}