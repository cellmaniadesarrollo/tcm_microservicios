import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

@Injectable()
export class SequencesService {
    /**
     * Reserva `count` números consecutivos para (empresa, clave) y devuelve el PRIMERO.
     * Ej.: reserve(em, companyId, 'lot_code', 3) -> 10  => usa 10, 11, 12.
     * Bloquea la fila hasta que termine la transacción, por eso dos ingresos simultáneos se serializan.
     */
    async reserve(em: EntityManager, companyId: string, key: string, count = 1): Promise<number> {
        const rows = await em.query(
            `INSERT INTO company_sequences (company_id, "key", last_value, updated_at)
             VALUES ($1, $2, $3, now())
             ON CONFLICT (company_id, "key")
             DO UPDATE SET last_value = company_sequences.last_value + $3, updated_at = now()
             RETURNING last_value`,
            [companyId, key, count],
        );
        return Number(rows[0].last_value) - count + 1;
    }
}