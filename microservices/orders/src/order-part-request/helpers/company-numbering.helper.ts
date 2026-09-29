import { EntityManager } from 'typeorm';

/**
 * Incrementa y devuelve el siguiente número secuencial de una empresa.
 * Debe ejecutarse dentro de una transacción: el upsert bloquea la fila
 * del contador hasta el commit y, si la transacción falla, el contador
 * se revierte y no quedan huecos.
 */
export async function nextCompanyNumber(
    manager: EntityManager,
    companyId: string,
    key: string,
): Promise<number> {
    const rows = await manager.query(
        `INSERT INTO company_counters (company_id, key, last_value)
         VALUES ($1, $2, 1)
         ON CONFLICT (company_id, key)
         DO UPDATE SET last_value = company_counters.last_value + 1
         RETURNING last_value`,
        [companyId, key],
    );
    return Number(rows[0].last_value);
}

export const formatPartRequestNumber = (n: number | null | undefined): string =>
    n == null ? '' : `SR-${String(n).padStart(5, '0')}`;