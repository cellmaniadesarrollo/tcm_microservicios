import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { SriDocument } from '../../sri-documents/entities/sri-document.entity';
import { StockClientService } from '../services/stock-client.service';

@Injectable()
export class StockReconcileCron {
  constructor(
    private readonly ds: DataSource,
    private readonly stock: StockClientService,
  ) {}

  /** Facturas NO AUTORIZADAS cuyo stock no se pudo devolver. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcile() {
    const repo = this.ds.getRepository(SriDocument);

    const invoices = await repo.find({
      where: { stockState: 'ISSUED', statusCode: 'NAT' },
      select: { id: true, companyId: true },
      take: 50,
    });
    for (const d of invoices) await this.stock.giveBack(d.companyId, d.id);

    // NC autorizadas cuyo reingreso quedó pendiente
    const creditNotes = await repo.find({
      where: { documentTypeCode: '04', stockState: 'TO_RETURN', statusCode: 'AUT' },
      select: { id: true, companyId: true },
      take: 50,
    });
    for (const d of creditNotes) await this.stock.returnCreditNote(d.companyId, d.id);
  }
}