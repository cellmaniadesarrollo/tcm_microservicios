import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DiscountInput, DiscountsService } from '../../discounts/services/discounts.service';
import { IssuersService } from '../../issuer/services/issuers.service';
import { SriPaymentMethod } from '../../sri-catalogs/entities/sri-payment-method.entity';
import { SriVatRate } from '../../sri-catalogs/entities/sri-vat-rate.entity';
import { SriErrorCode } from '../../sri-catalogs/entities/sri-error-code.entity';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { SriDocument } from '../entities/sri-document.entity';
import { SriDocumentLine } from '../entities/sri-document-line.entity';
import { SriDocumentPayment } from '../entities/sri-document-payment.entity';
import { buildAccessKey } from '../helpers/access-key.helper';
import { calculateTotals, LineInput } from '../helpers/totals.helper';
import { StockClientService } from '../../documents/services/stock-client.service';
import { SriSequenceService } from './sri-sequence.service';
import { SriEmissionService } from './sri-emission.service'; // CAMBIO
import { VatRatesService } from './vat-rates.service'; // CAMBIO

const money = (cents: number) => (cents / 100).toFixed(2);

@Injectable()
export class SriDocumentsService {
  private readonly logger = new Logger(SriDocumentsService.name);

  // CAMBIO: ya no inyecta documents, s3, signing, submission ni broadcast
  constructor(
    private readonly ds: DataSource,
    private readonly issuers: IssuersService,
    private readonly sequences: SriSequenceService,
    private readonly discounts: DiscountsService,
    private readonly stock: StockClientService,
    private readonly vatRates: VatRatesService,
    private readonly emission: SriEmissionService,
  ) {}

  async createInvoice(companyId: string, userId: string, dto: CreateInvoiceDto) {
    // idempotencia
    const prev = await this.ds.getRepository(SriDocument).findOne({
      where: { companyId, clientRequestId: dto.clientRequestId },
      relations: { lines: true, payments: true },
    });
    if (prev) return { ...prev, replayed: true };

    // emisor, firma, establecimiento y punto de emisión
    const r = await this.issuers.resolveForBranch(companyId, dto.branchId, userId, dto.emissionPointId);
    const series = r.establishmentCode + r.emissionPointCode;

    // tarifas desde el catálogo (nunca confiar en el porcentaje del front)
    const rates = await this.vatRates.load(dto.lines.map((l) => l.vatRateCode)); // CAMBIO

    const created = await this.ds.transaction(async (m) => {
      try {
        // 1) Resolver descuentos del catálogo en el servidor
        const applied: (DiscountInput & { position: number })[] = [];
        const lineInputs: LineInput[] = [];

        for (const [i, l] of dto.lines.entries()) {
          const rate = rates.get(l.vatRateCode);
          if (!rate) throw new BadRequestException(`Tarifa de IVA no válida: ${l.vatRateCode}`);

          const gross = Math.round(l.quantity * l.unitPrice * 100 + Number.EPSILON);
          let disc = 0;

          if (l.discountId) {
            const res = await this.discounts.resolveForLine(
              m,
              companyId,
              l.discountId,
              gross,
              rate.kind === 'VAT' ? rate.percentage : 0,
            );
            disc = Math.min(res.cents, gross);
            if (disc > 0) {
              applied.push({
                position: i + 1,
                lineId: null,
                discountId: l.discountId,
                type: res.discount.type,
                amount: money(disc),
                base: money(gross),
                reason: res.discount.name,
              });
            }
          }

          lineInputs.push({
            productId: l.productId,
            lotId: l.lotId,
            unitId: l.unitId,
            mainCode: l.mainCode,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: disc / 100, // dólares, como espera calculateTotals
            vatRateCode: l.vatRateCode,
            vatPercentage: rate.percentage,
            vatKind: rate.kind,
          });
        }

        // 2) Totales y validación de pagos
        const t = calculateTotals(lineInputs, { tip: dto.tip });

        const paid = dto.payments.reduce((s, p) => s + Math.round(p.amount * 100), 0);
        if (paid !== Math.round(Number(t.total) * 100))
          throw new BadRequestException('La suma de los pagos no coincide con el total.');

        // 3) Secuencia, clave de acceso y guardado
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

        // 4) Descuentos aplicados, en la misma transacción
        const savedLines = (doc.lines ?? []) as unknown as SriDocumentLine[];

        await this.discounts.record(
          m,
          { companyId, branchId: dto.branchId, userId },
          'FACTURA',
          doc.id,
          applied.map(({ position, ...d }) => ({
            ...d,
            lineId: savedLines.find((x) => x.position === position)?.id ?? null,
          })),
        );

        // 5) Descontar stock. Si no alcanza, lanza y se revierte la factura completa.
        const stockLines = this.stock.buildLines(savedLines);
        let stockState = 'NONE';
        if (stockLines.length) {
          try {
            await this.stock.outbound({
              companyId,
              userId,
              branchId: dto.branchId,
              refType: 'FACTURA',
              documentId: doc.id,
              lines: stockLines,
            });
          } catch (e: any) {
            this.logger.error(`Stock outbound falló: ${JSON.stringify(e?.message ?? e)}`, e?.stack);
            throw new BadRequestException(this.stock.errorMessage(e));
          }
          stockState = 'ISSUED';
          await m.update(SriDocument, { id: doc.id }, { stockState });
        }

        return { ...doc, stockState, replayed: false };
      } catch (e: any) {
        this.logger.error(`createInvoice falló: ${e?.message}`, e?.stack);
        throw e;
      }
    });

    // CAMBIO: XML -> firma -> aviso -> envío en segundo plano, todo en un solo paso
    const signed = await this.emission.finalize(companyId, created.id);

    // Si firmó, devolvemos el estado real (FIRMADO) sin los XML pesados.
    if (signed) {
      const fresh = await this.emission.fresh(companyId, created.id);
      if (fresh) return { ...fresh, replayed: false };
    }
    return created;
  }

  // CAMBIO: eliminados buildAndStoreXml, trySign, sendInBackground, loadVatRates y notify
  // (ahora viven en SriEmissionService y VatRatesService)

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

  // CAMBIO: filtro opcional por tipo de documento (01 factura, 04 NC, 05 ND)
  async list(companyId: string, documentTypeCode?: string) {
    const items = await this.ds.getRepository(SriDocument).find({
      where: { companyId, ...(documentTypeCode ? { documentTypeCode } : {}) },
      relations: { lines: true },
      order: { createdAt: 'DESC', lines: { position: 'ASC' } },
      take: 100,
    });
    // no se devuelven los XML en el listado
    return {
      items: items.map(({ xmlUnsigned, xmlSigned, xmlAuthorized, ...rest }) => rest),
    };
  }

  async findOne(companyId: string, id: string) {
    const doc = await this.ds.getRepository(SriDocument).findOne({
      where: { id, companyId },
      relations: { lines: true, payments: true },
      order: { lines: { position: 'ASC' } },
    });
    if (!doc) throw new BadRequestException('Documento no encontrado.');
    const { xmlUnsigned, xmlSigned, xmlAuthorized, ...rest } = doc;

    let lines: any[] = rest.lines;
    if (doc.documentTypeCode === '01') {
      const credited = await this.creditedByLine(doc.id);
      lines = rest.lines.map((l) => {
        const c = credited.get(l.id) ?? 0;
        return {
          ...l,
          creditedQuantity: c.toFixed(6),
          pendingQuantity: Math.max(Number(l.quantity) - c, 0).toFixed(6),
        };
      });
    }
    return { ...rest, lines, errorInfo: await this.errorInfo(doc.lastErrorCode) };
  }

  /** Cantidad ya acreditada por línea (NC no rechazadas ni devueltas). */
  private async creditedByLine(invoiceId: string) {
    const rows = await this.ds
      .getRepository(SriDocumentLine)
      .createQueryBuilder('l')
      .innerJoin('l.document', 'd')
      .select('l.source_line_id', 'sid')
      .addSelect('SUM(l.quantity)', 'qty')
      .where('d.modifiedDocumentId = :id', { id: invoiceId })
      .andWhere("d.statusCode NOT IN ('NAT', 'DEVUELTO')")
      .groupBy('l.source_line_id')
      .getRawMany<{ sid: string; qty: string }>();
    return new Map(rows.map((r) => [r.sid, Number(r.qty)]));
  }

  private async errorInfo(code: string | null) {
    if (!code) return null;
    const e = await this.ds.getRepository(SriErrorCode).findOne({ where: { code } });
    if (!e) return null;
    const blocked = e.kind === 'ERROR' && (e.terminal || !e.retryable);
    return { code: e.code, name: e.name, description: e.description, blocked };
  }

  async correct(companyId: string, id: string, dto: any) {
    const repo = this.ds.getRepository(SriDocument);
    const doc = await repo.findOne({
      where: { id, companyId },
      relations: { lines: true, payments: true },
      order: { lines: { position: 'ASC' } },
    });
    if (!doc) throw new BadRequestException('Documento no encontrado.');
    // CAMBIO: esta corrección solo aplica a facturas (la NC tiene otra estructura)
    if (doc.documentTypeCode !== '01')
      throw new BadRequestException('Solo se pueden corregir facturas con este método.');
    if (!['DEVUELTO', 'NAT'].includes(doc.statusCode))
      throw new BadRequestException('Solo se corrigen facturas devueltas o no autorizadas.');

    const info = await this.errorInfo(doc.lastErrorCode);
    if (info?.blocked)
      throw new BadRequestException(
        `No se puede reenviar. Error ${info.code}: ${info.name}. ${info.description}`,
      );

    // NAT: clave nueva con el mismo secuencial. DEVUELTO: misma clave.
    const accessKey =
      doc.statusCode === 'NAT'
        ? buildAccessKey({
            issueDate: doc.issueDate,
            documentTypeCode: doc.documentTypeCode,
            ruc: doc.accessKey!.slice(10, 23),
            environmentCode: doc.environmentCode,
            series: doc.series,
            sequence: doc.sequence,
            emissionTypeCode: doc.emissionTypeCode,
          })
        : doc.accessKey;

    // ── Líneas: solo cambian código, descripción, precio e IVA ──
    const lines = doc.lines ?? [];
    const edits = new Map<string, any>((dto.lines ?? []).map((l: any) => [l.id, l]));
    for (const key of edits.keys()) {
      if (!lines.some((l) => l.id === key))
        throw new BadRequestException('Una línea no pertenece a esta factura.');
    }

    const rates = await this.vatRates.load( // CAMBIO
      lines.map((l) => edits.get(l.id)?.vatRateCode ?? l.vatRateCode),
    );

    const lineInputs: LineInput[] = lines.map((l) => {
      const e = edits.get(l.id);
      const vatRateCode = e?.vatRateCode ?? l.vatRateCode;
      const rate = rates.get(vatRateCode);
      if (!rate) throw new BadRequestException(`Tarifa de IVA no válida: ${vatRateCode}`);

      const unitPrice = e ? Number(e.unitPrice) : Number(l.unitPrice);
      const quantity = Number(l.quantity);
      const discount = Number(l.discount); // dólares, se conserva tal cual
      if (discount > quantity * unitPrice + 0.005)
        throw new BadRequestException(`El descuento supera el valor de la línea ${l.position}.`);

      return {
        productId: l.productId,
        lotId: l.lotId,
        unitId: l.unitId,
        mainCode: e?.mainCode ?? l.mainCode,
        description: e?.description ?? l.description,
        quantity,
        unitPrice,
        discount,
        vatRateCode,
        vatPercentage: rate.percentage,
        vatKind: rate.kind,
      };
    });

    const t = calculateTotals(lineInputs, { tip: Number(doc.tip) });
    const newTotalCents = Math.round(Number(t.total) * 100);

    // ── Pagos: con un solo pago se ajusta; con varios debe seguir cuadrando ──
    const payments = doc.payments ?? [];
    const paidCents = payments.reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0);
    if (payments.length !== 1 && paidCents !== newTotalCents)
      throw new BadRequestException(
        'El nuevo total no coincide con los pagos de la factura. Esta factura tiene varios pagos y no se pueden ajustar automáticamente.',
      );

    await this.ds.transaction(async (m) => {
      // La condición por estado evita dos reenvíos simultáneos
      const res = await m.update(
        SriDocument,
        { id, companyId, statusCode: doc.statusCode },
        {
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
          accessKey,
          statusCode: 'BORRADOR',
          xmlUnsigned: null,
          xmlSigned: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          sriMessages: null,
          attempts: 0,
          nextRetryAt: null,
        },
      );
      if (!res.affected) throw new BadRequestException('El documento cambió, recarga la página.');

      // Línea por línea, sin tocar producto, lote, unidad ni cantidad (el stock no se mueve)
      for (const [i, l] of lines.entries()) {
        const { productId, lotId, unitId, quantity, ...changes } = t.lines[i] as any;
        await m.update(SriDocumentLine, { id: l.id }, changes);
      }

      if (payments.length === 1) {
        await m.update(SriDocumentPayment, { id: payments[0].id }, { amount: t.total });
      }
    });

    // CAMBIO: un solo paso en lugar de buildAndStoreXml + trySign + notify + sendInBackground
    const signed = await this.emission.finalize(companyId, id);

    return { id, signed };
  }
}