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
    const pending = await this.ds.getRepository(SriDocument).find({
      where: { stockState: 'ISSUED', statusCode: 'NAT' },
      select: { id: true, companyId: true },
      take: 50,
    });
    for (const d of pending) await this.stock.giveBack(d.companyId, d.id);
  }
}