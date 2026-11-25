import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { DataSource } from 'typeorm';
import { SriDocument } from '../../sri-documents/entities/sri-document.entity';

export const INVENTORY_CORE_CLIENT = 'INVENTORY_CORE_CLIENT';
const SYSTEM_USER = '00000000-0000-0000-0000-000000000000';

export type StockRefType = 'FACTURA' | 'RECIBO';
export type StockLine = { lineRef: string; lotId: string; quantity: number; unitIds?: string[] };
type LineLike = { lotId?: string | null; unitId?: string | null; quantity: string | number };

@Injectable()
export class StockClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StockClientService.name);

  constructor(
    @Inject(INVENTORY_CORE_CLIENT) private readonly client: ClientProxy,
    private readonly ds: DataSource,
  ) {}

  async onModuleInit() {
    try {
      await this.client.connect();
    } catch (e: any) {
      this.logger.error(`INVENTORY_CORE no disponible al arrancar: ${e?.message}`);
    }
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  private call<T = any>(cmd: string, payload: Record<string, any>, ms = 10_000) {
    return firstValueFrom(
      this.client
        .send<T>({ cmd }, { internalToken: process.env.INTERNAL_SECRET, ...payload })
        .pipe(timeout(ms)),
    );
  }

  /** Convierte el error RPC en un texto legible. */
  errorMessage(e: any): string {
    const m = e?.message ?? e;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
    return m?.message ? String(m.message) : 'No se pudo completar la operación de stock.';
  }

  /** Une líneas del mismo lote (inventory-core exige una por lote). Ignora las manuales. */
  buildLines(lines: LineLike[]): StockLine[] {
    const byLot = new Map<string, { lineRef: string; lotId: string; quantity: number; unitIds: string[] }>();
    for (const l of lines) {
      if (!l.lotId) continue;
      const e = byLot.get(l.lotId) ?? { lineRef: l.lotId, lotId: l.lotId, quantity: 0, unitIds: [] };
      e.quantity += Math.round(Number(l.quantity));
      if (l.unitId) e.unitIds.push(l.unitId);
      byLot.set(l.lotId, e);
    }
    return [...byLot.values()].map((e) => ({ ...e, unitIds: e.unitIds.length ? e.unitIds : undefined }));
  }

  /** Descuenta stock. LANZA si no hay disponible (para revertir la transacción de quien llama). */
  outbound(p: {
    companyId: string; userId: string; branchId: string;
    refType: StockRefType; documentId: string; lines: StockLine[];
  }) {
    return this.call('stock.outbound', {
      companyId: p.companyId, userId: p.userId, branchId: p.branchId,
      reference: { type: p.refType, id: p.documentId }, lines: p.lines,
    });
  }

  /** Devuelve stock. LANZA si falla; quien llama decide si reintentar. */
  inbound(p: {
    companyId: string; branchId: string;
    refType: StockRefType; documentId: string; lines: StockLine[];
  }) {
    return this.call('stock.return', {
      companyId: p.companyId, userId: SYSTEM_USER, branchId: p.branchId,
      reference: { type: p.refType, id: p.documentId }, lines: p.lines,
    });
  }

  /** Factura NO AUTORIZADA: devuelve el stock. Nunca lanza; si falla, el cron reintenta. */
  async giveBack(companyId: string, documentId: string) {
    try {
      const repo = this.ds.getRepository(SriDocument);
      const doc = await repo.findOne({ where: { id: documentId, companyId }, relations: { lines: true } });
      if (!doc || doc.stockState !== 'ISSUED' || !doc.branchId) return;

      const lines = this.buildLines(doc.lines);
      if (lines.length) {
        await this.inbound({
          companyId, branchId: doc.branchId, refType: 'FACTURA', documentId, lines,
        });
      }
      await repo.update({ id: documentId, companyId }, { stockState: 'RETURNED' });
    } catch (e: any) {
      this.logger.error(`Devolución de stock de ${documentId} falló: ${this.errorMessage(e)}`);
    }
  }
}