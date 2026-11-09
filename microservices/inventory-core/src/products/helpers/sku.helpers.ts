import { Model } from '../../devices-replica/entities/model.entity';
import { KIND_PREFIX } from '../constants/product.constants';

/** 3 letras de la marca si todos los modelos son de la misma; GEN si hay varias o ninguna. */
export function brandCode(models: Model[]): string {
    const brands = new Map(models.map((m) => [m.brand.brands_id, m.brand.brands_name]));
    if (brands.size !== 1) return 'GEN';
    const [name] = brands.values();
    return name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'X');
}

/** Correlativo con ceros a la izquierda (también se usa como UPC por defecto). */
export const padCode = (code: number) => String(code).padStart(6, '0');

/** SKU: PREFIJO-TIPO-MARCA-CORRELATIVO. Ej: REP-BAT-SAM-000012 */
export function buildSku(kind: string, typeCode: string, models: Model[], code: number): string {
    return [KIND_PREFIX[kind] ?? 'GEN', typeCode, brandCode(models), padCode(code)].join('-');
}