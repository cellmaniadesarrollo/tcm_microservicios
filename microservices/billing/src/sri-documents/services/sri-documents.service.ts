import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { IssuersService } from '../../issuer/services/issuers.service';
import { SriPaymentMethod } from '../../sri-catalogs/entities/sri-payment-method.entity';
import { SriVatRate } from '../../sri-catalogs/entities/sri-vat-rate.entity';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { SriDocument } from '../entities/sri-document.entity';
import { buildAccessKey } from '../helpers/access-key.helper';
import { calculateTotals, LineInput, VatKind } from '../helpers/totals.helper';
import { SriSequenceService } from './sri-sequence.service';

@Injectable()
export class SriDocumentsService {
  constructor(
    private readonly ds: DataSource,
    private readonly issuers: IssuersService,
    private readonly sequences: SriSequenceService,
  ) {}

  async createInvoice(companyId: string, dto: CreateInvoiceDto) {
    // idempotencia
    const prev = await this.ds.getRepository(SriDocument).findOne({
      where: { companyId, clientRequestId: dto.clientRequestId },
      relations: { lines: true, payments: true },
    });
    if (prev) return { ...prev, replayed: true };

    // emisor, firma y establecimiento de la sucursal
    const r = await this.issuers.resolveForBranch(companyId, dto.branchId);
    const series = r.establishmentCode + r.emissionPointCode;

    // tarifas desde el catálogo (nunca confiar en el porcentaje del front)
    const rates = await this.loadVatRates(dto.lines.map((l) => l.vatRateCode));
    const lineInputs: LineInput[] = dto.lines.map((l) => {
      const rate = rates.get(l.vatRateCode);
      if (!rate) throw new BadRequestException(`Tarifa de IVA no válida: ${l.vatRateCode}`);
      return { ...l, vatPercentage: rate.percentage, vatKind: rate.kind };
    });

    const t = calculateTotals(lineInputs, { tip: dto.tip });

    // los pagos deben cuadrar con el total
    const paid = dto.payments.reduce((s, p) => s + Math.round(p.amount * 100), 0);
    if (paid !== Math.round(Number(t.total) * 100))
      throw new BadRequestException('La suma de los pagos no coincide con el total.');

    return this.ds.transaction(async (m) => {
      const sequence = await this.sequences.next(
        { companyId, issuerId: r.issuer.id, documentTypeCode: '01', series },
        m,
      );
      const accessKey = buildAccessKey({
        issueDate: dto.issueDate,
        documentTypeCode: '01',
        ruc: r.issuer.ruc,
        environmentCode: String(r.issuer.environment),
        series,
        sequence,
      });

      const doc = await m.save(SriDocument, {
        companyId,
        issuerId: r.issuer.id,
        signatureId: r.signatureId,
        branchId: dto.branchId,
        orderId: dto.orderId ?? null,
        documentTypeCode: '01',
        environmentCode: String(r.issuer.environment),
        emissionTypeCode: String(r.issuer.emissionType),
        statusCode: 'BORRADOR',
        series,
        sequence,
        accessKey,
        issueDate: dto.issueDate,
        buyerIdTypeCode: dto.buyerIdTypeCode,
        buyerIdNumber: dto.buyerIdNumber.trim(),
        buyerName: dto.buyerName.trim().toUpperCase(),
        buyerAddress: dto.buyerAddress?.trim() || null,
        buyerEmail: dto.buyerEmail?.trim() || null,
        subtotalVat: t.subtotalVat,
        subtotalZero: t.subtotalZero,
        subtotalNotObject: t.subtotalNotObject,
        subtotalExempt: t.subtotalExempt,
        subtotal: t.subtotal,
        totalDiscount: t.totalDiscount,
        iceValue: t.iceValue,
        vatValue: t.vatValue,
        tip: t.tip,
        total: t.total,
        clientRequestId: dto.clientRequestId,
        lines: t.lines,
        payments: dto.payments.map((p) => ({
          methodCode: p.methodCode,
          amount: p.amount.toFixed(2),
          term: p.term ?? null,
          timeUnit: p.timeUnit ?? null,
        })),
      });

      return { ...doc, replayed: false };
    });
  }

  /** Tarifas activas del catálogo, con el tipo derivado del código. */
  private async loadVatRates(codes: string[]) {
    const unique = [...new Set(codes)];
    const rows = await this.ds.getRepository(SriVatRate).find({
      where: { code: In(unique), active: true },
    });

    const kindOf = (r: SriVatRate): VatKind => {
      if (r.taxable) return 'VAT';
      if (r.code === '6') return 'NOT_OBJECT';
      if (r.code === '7') return 'EXEMPT';
      return 'ZERO'; // código 0
    };

    return new Map(
      rows.map((r) => [r.code, { percentage: Number(r.percentage), kind: kindOf(r) }]),
    );
  }

  /** Tarifas de IVA activas. */
  async listVatRates() {
    const items = await this.ds.getRepository(SriVatRate).find({
      where: { active: true },
      order: { code: 'ASC' },
      select: { code: true, name: true, percentage: true, taxable: true },
    });
    return { items: items.map((r) => ({ ...r, percentage: Number(r.percentage) })) };
  }

  /** Formas de pago activas (tabla 24 del SRI). */
  async listPaymentMethods() {
    const items = await this.ds.getRepository(SriPaymentMethod).find({
      where: { active: true },
      order: { code: 'ASC' },
      select: { code: true, name: true },
    });
    return { items };
  }

  async list(companyId: string) {
    const items = await this.ds.getRepository(SriDocument).find({
      where: { companyId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    // no se devuelven los XML en el listado
    return {
      items: items.map(({ xmlUnsigned, xmlSigned, xmlAuthorized, ...rest }) => rest),
    };
  }
}