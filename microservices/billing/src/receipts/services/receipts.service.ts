import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DiscountInput, DiscountsService } from '../../discounts/services/discounts.service';
import { CreateReceiptDto } from '../dto/create-receipt.dto';
import { Receipt } from '../entities/receipt.entity';
import { formatReceiptNumber } from '../helpers/receipt-number.helper';
import { ReceiptSequenceService } from './receipt-sequence.service';
import { StockClientService } from '../../documents/services/stock-client.service';
import { BroadcastService } from '../../broadcast/service/broadcast.service';

const toCents = (n: number) => Math.round(n * 100 + Number.EPSILON);
const money = (cents: number) => (cents / 100).toFixed(2);

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly ds: DataSource,
    private readonly sequences: ReceiptSequenceService,
    private readonly discounts: DiscountsService,
    private readonly stock: StockClientService,
    private readonly broadcast: BroadcastService,
  ) {}

  /** Avisa a la lista en vivo. emit() nunca lanza. */
  private async notify(r: Receipt) {
    try {
      await this.broadcast.publishReceiptUpdated({
        company_id: r.companyId,
        id: r.id,
        kind: r.kind,
        number: formatReceiptNumber({ kind: r.kind, series: r.series, sequence: r.sequence }),
        buyerName: r.buyerName,
        buyerIdNumber: r.buyerIdNumber,
        issueDate: r.issueDate,
        createdAt: r.createdAt,
        total: r.total,
        statusCode: r.statusCode,
      });
    } catch { /* nunca debe romper la venta */ }
  }

  private present(r: Receipt, replayed: boolean) {
    return {
      ...r,
      number: formatReceiptNumber({ kind: r.kind, series: r.series, sequence: r.sequence }),
      replayed,
    };
  }

  private findPrev(companyId: string, clientRequestId: string) {
    return this.ds.getRepository(Receipt).findOne({
      where: { companyId, clientRequestId },
      relations: { lines: true },
      order: { lines: { position: 'ASC' } },
    });
  }

  async createReceipt(companyId: string, userId: string, dto: CreateReceiptDto) {
    // idempotencia
    const prev = await this.findPrev(companyId, dto.clientRequestId);
    if (prev) return this.present(prev, true);

    const series = await this.sequences.seriesForBranch(companyId, dto.branchId);

    try {
      const result = await this.ds.transaction(async (m) => {
        // El servidor recalcula; nunca se confía en el total ni en descuentos del front.
        let subtotal = 0;
        let discountTotal = 0;
        const applied: (DiscountInput & { position: number })[] = [];
        const lines: any[] = [];

        for (const [i, l] of dto.lines.entries()) {
          const position = i + 1;
          const gross = toCents(l.quantity * l.unitPrice);
          let disc = 0;

          if (l.discountId) {
            const r = await this.discounts.resolveForLine(m, companyId, l.discountId, gross);
            disc = Math.min(r.cents, gross);
            if (disc > 0) {
              applied.push({
                position,
                lineId: null, // se completa tras guardar el recibo
                discountId: l.discountId,
                type: r.discount.type,
                amount: money(disc),
                base: money(gross),
                reason: r.discount.name,
              });
            }
          }

          const net = gross - disc;
          subtotal += net;
          discountTotal += disc;

          lines.push({
            position,
            productId: l.productId ?? null,
            lotId: l.lotId ?? null,
            unitId: l.unitId ?? null,
            batch: l.batch?.trim() || null,
            mainCode: l.mainCode.trim(),
            description: l.description.trim(),
            quantity: l.quantity.toFixed(6),
            unitPrice: l.unitPrice.toFixed(6),
            discount: money(disc),
            lineTotal: money(net),
            vatAmount: '0.00', // el recibo no desglosa IVA
          });
        }

        if (toCents(dto.total) !== subtotal)
          throw new BadRequestException('El total no coincide con el detalle del recibo.');

        const sequence = await this.sequences.next(
          { companyId, branchId: dto.branchId, kind: 'RECIBO', series },
          m,
        );

        const receipt = (await m.save(Receipt, {
          companyId,
          branchId: dto.branchId,
          orderId: null,
          kind: 'RECIBO',
          relatedReceiptId: null,
          series,
          sequence,
          issueDate: dto.issueDate,
          statusCode: 'EMITIDO',
          buyerIdNumber: dto.buyerIdNumber?.trim() || null,
          buyerName: dto.buyerName?.trim().toUpperCase() || 'CONSUMIDOR FINAL',
          paymentMethod: dto.paymentMethod,
          subtotal: money(subtotal),
          totalDiscount: money(discountTotal),
          vatValue: '0.00',
          total: money(subtotal),
          clientRequestId: dto.clientRequestId,
          lines,
        })) as Receipt;

        // Registro de descuentos aplicados, en la misma transacción.
        await this.discounts.record(
          m,
          { companyId, branchId: dto.branchId, userId },
          'RECIBO',
          receipt.id,
          applied.map(({ position, ...d }) => ({
            ...d,
            lineId: receipt.lines?.find((x) => x.position === position)?.id ?? null,
          })),
        );

        // Descontar stock en inventory-core. Si no alcanza, lanza y se revierte el recibo completo.
        const stockLines = this.stock.buildLines(lines);
        if (stockLines.length) {
          try {
            await this.stock.outbound({
              companyId, userId, branchId: dto.branchId,
              refType: 'RECIBO', documentId: receipt.id, lines: stockLines,
            });
          } catch (e: any) {
            throw new BadRequestException(this.stock.errorMessage(e));
          }
          await m.update(Receipt, { id: receipt.id }, { stockState: 'ISSUED' });
          receipt.stockState = 'ISSUED';
        }

          return { presented: this.present(receipt, false), receipt };
        });
      await this.notify(result.receipt);
      return result.presented;
    } catch (e: any) {
      // Dos peticiones simultáneas con el mismo clientRequestId: gana una, la otra reproduce.
      if (e?.code === '23505') {
        const again = await this.findPrev(companyId, dto.clientRequestId);
        if (again) return this.present(again, true);
      }
      throw e;
    }
  }

  async list(companyId: string) {
    const items = await this.ds.getRepository(Receipt).find({
      where: { companyId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return {
      items: items.map((r) => ({
        ...r,
        number: formatReceiptNumber({ kind: r.kind, series: r.series, sequence: r.sequence }),
      })),
    };
  }
}