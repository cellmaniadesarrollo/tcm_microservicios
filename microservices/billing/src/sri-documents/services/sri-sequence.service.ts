import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class SriSequenceService {
  constructor(private readonly ds: DataSource) {}

  /**
   * Devuelve el siguiente secuencial de 9 dígitos.
   * Pasa el `manager` de la transacción que crea el comprobante: si esa transacción
   * falla, el contador también se revierte y no quedan huecos.
   */
  async next(
    p: { companyId: string; issuerId: string; documentTypeCode: string; series: string },
    manager: EntityManager = this.ds.manager,
  ): Promise<string> {
    const rows: { last_value: number }[] = await manager.query(
      `INSERT INTO sri_sequences (company_id, issuer_id, document_type_code, series, last_value, updated_at)
       VALUES ($1, $2, $3, $4, 1, now())
       ON CONFLICT (issuer_id, document_type_code, series)
       DO UPDATE SET last_value = sri_sequences.last_value + 1, updated_at = now()
       RETURNING last_value`,
      [p.companyId, p.issuerId, p.documentTypeCode, p.series],
    );
    return String(rows[0].last_value).padStart(9, '0');
  }
}