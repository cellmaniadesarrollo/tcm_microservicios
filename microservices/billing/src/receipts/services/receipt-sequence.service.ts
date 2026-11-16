import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { BranchReplica } from '../../companies/entities/branch-replica.entity';

@Injectable()
export class ReceiptSequenceService {
  constructor(private readonly ds: DataSource) {}

  /** Serie de 6 dígitos: establecimiento (código de la sucursal) + punto de emisión. */
  async seriesForBranch(companyId: string, branchId: string): Promise<string> {
    const branch = await this.ds.getRepository(BranchReplica).findOne({
      where: { id: branchId, company: { id: companyId } },
    });
    if (!branch) throw new BadRequestException('Sucursal no válida.');
    if (!/^\d{1,3}$/.test(branch.code))
      throw new BadRequestException('El código de la sucursal debe ser numérico de hasta 3 dígitos.');
    return branch.code.padStart(3, '0') + '001'; // punto de emisión fijo, igual que en facturas
  }

  /** Siguiente secuencial de 9 dígitos. Pasa el manager de la transacción. */
  async next(
    p: { companyId: string; branchId: string; kind: 'RECIBO' | 'RETORNO'; series: string },
    manager: EntityManager = this.ds.manager,
  ): Promise<string> {
    const rows: { last_value: number }[] = await manager.query(
      `INSERT INTO receipt_sequences (company_id, branch_id, kind, series, last_value, updated_at)
       VALUES ($1, $2, $3, $4, 1, now())
       ON CONFLICT (company_id, branch_id, kind, series)
       DO UPDATE SET last_value = receipt_sequences.last_value + 1, updated_at = now()
       RETURNING last_value`,
      [p.companyId, p.branchId, p.kind, p.series],
    );
    return String(rows[0].last_value).padStart(9, '0');
  }
}