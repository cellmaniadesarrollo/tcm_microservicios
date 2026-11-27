import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { DiscountInput, DiscountsService } from '../../discounts/services/discounts.service';
import { DocumentsService } from '../../documents/services/documents.service';
import { IssuersService } from '../../issuer/services/issuers.service';
import { SriPaymentMethod } from '../../sri-catalogs/entities/sri-payment-method.entity';
import { SriVatRate } from '../../sri-catalogs/entities/sri-vat-rate.entity';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { SriDocument } from '../entities/sri-document.entity';
import { SriDocumentLine } from '../entities/sri-document-line.entity';
import { buildAccessKey } from '../helpers/access-key.helper';
import { calculateTotals, LineInput, VatKind } from '../helpers/totals.helper';
import { SriSequenceService } from './sri-sequence.service';
import { saveDebugXml } from '../../documents/helpers/xml-file.helper';
import { AwsS3Service } from '../../aws-s3/aws-s3.service';
import { SRI_BUCKET, sriXmlKey } from '../../documents/helpers/xml-storage.helper';
import { SigningService } from '../../documents/services/signing.service';
import { SriSubmissionService } from '../../documents/services/sri-submission.service';
import { StockClientService } from '../../documents/services/stock-client.service';
import { BroadcastService } from '../../broadcast/service/broadcast.service';
import { SriErrorCode } from '../../sri-catalogs/entities/sri-error-code.entity';
import { SriDocumentPayment } from '../entities/sri-document-payment.entity';

const money = (cents: number) => (cents / 100).toFixed(2);

@Injectable()
export class SriDocumentsService {
  private readonly logger = new Logger(SriDocumentsService.name);

  constructor(
    private readonly ds: DataSource,
    private readonly issuers: IssuersService,
    private readonly sequences: SriSequenceService,
    private readonly discounts: DiscountsService,
    private readonly documents: DocumentsService,
    private readonly s3: AwsS3Service,
    private readonly signing: SigningService,
    private readonly submission: SriSubmissionService,
    private readonly stock: StockClientService,
    private readonly broadcast: BroadcastService,
  ) {}

  async createInvoice(companyId: string, userId: string, dto: CreateInvoiceDto) {
    // idempotencia
    const prev = await this.ds.getRepository(SriDocument).findOne({
      where: { companyId, clientRequestId: dto.clientRequestId },
      relations: { lines: true, payments: true },
    });
    if (prev) return { ...prev, replayed: true };

    // emisor, firma, establecimiento y punto de emisión
    const r = await this.issuers.resolveForBranch(companyId, dto.branchId, userId, dto.emissionPointId); // CAMBIO
    const series = r.establishmentCode + r.emissionPointCode;

    // tarifas desde el catálogo (nunca confiar en el porcentaje del front)
    const rates = await this.loadVatRates(dto.lines.map((l) => l.vatRateCode));

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
            companyId, userId, branchId: dto.branchId,
            refType: 'FACTURA', documentId: doc.id, lines: stockLines,
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

    await this.buildAndStoreXml(companyId, created.id);
    const signed = await this.trySign(companyId, created.id);
    await this.notify(companyId, created.id);

    // Envío al SRI en segundo plano: el usuario no espera los 8-10 s de recepción + autorización.
    if (signed && process.env.SRI_AUTO_SEND !== 'false') {
      void this.sendInBackground(companyId, created.id);
    }

    // Si firmó, devolvemos el estado real (FIRMADO) sin los XML pesados.
    if (signed) {
      const fresh = await this.ds.getRepository(SriDocument).findOne({
        where: { id: created.id, companyId },
        relations: { lines: true, payments: true },
      });
      if (fresh) {
        const { xmlUnsigned, xmlSigned, xmlAuthorized, ...rest } = fresh as any;
        return { ...rest, replayed: false };
      }
    }
    return created;
  }

  /** Genera el XML sin firmar y lo guarda. Si falla, la factura queda en BORRADOR. */
  private async buildAndStoreXml(companyId: string, documentId: string) {
    try {
      const xml = (await this.documents.render(companyId, documentId, 'SRI_XML')) as string;
      const repo = this.ds.getRepository(SriDocument);
      await repo.update({ id: documentId, companyId }, { xmlUnsigned: xml });

      const doc = await repo.findOne({
        where: { id: documentId, companyId },
        select: { accessKey: true },
      });
      const accessKey = doc?.accessKey ?? documentId;

      // Copia en disco para depuración
      const path = await saveDebugXml(`${accessKey}.xml`, xml);

      // S3: FACTURACION/GENERADOS/<claveAcceso>.xml
      let s3Key: string | null = null;
      try {
        s3Key = await this.s3.putObject(
          sriXmlKey.generated(accessKey),
          Buffer.from(xml, 'utf8'),
          'application/xml',
          SRI_BUCKET,
        );
        await repo.update({ id: documentId, companyId }, { xmlUnsignedKey: s3Key });
      } catch (e: any) {
        this.logger.error(`XML ${documentId} no subió a S3: ${e?.message}`);
      }

      this.logger.log(
        `XML generado para ${documentId} (${xml.length} caracteres)` +
          (path ? ` -> ${path}` : '') +
          (s3Key ? ` -> s3:${s3Key}` : ''),
      );
    } catch (e: any) {
      this.logger.error(`No se pudo generar el XML de ${documentId}: ${e?.message}`, e?.stack);
    }
  }

  /** Firma tras generar el XML. Si falla, la factura queda en BORRADOR y se reintenta con POST /:id/sign. */
  private async trySign(companyId: string, documentId: string): Promise<boolean> {
    try {
      await this.signing.signDocument(companyId, documentId);
      return true;
    } catch (e: any) {
      this.logger.error(`No se pudo firmar ${documentId}: ${e?.message}`, e?.stack);
      return false;
    }
  }

  /** Recepción + autorización. Si falla, la factura queda FIRMADO/RECIBIDO y se reintenta con POST /:id/send. */
  private async sendInBackground(companyId: string, documentId: string) {
    try {
      const res = await this.submission.send(companyId, documentId);
      this.logger.log(`Envío SRI de ${documentId}: ${res.statusCode}`);
    } catch (e: any) {
      this.logger.error(`No se pudo enviar ${documentId} al SRI: ${e?.message}`, e?.stack);
    }
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
      relations: { lines: true },
      order: { createdAt: 'DESC', lines: { position: 'ASC' } },
      take: 100,
    });
    // no se devuelven los XML en el listado
    return {
      items: items.map(({ xmlUnsigned, xmlSigned, xmlAuthorized, ...rest }) => rest),
    };
  }

  /** Avisa a la lista en vivo con el estado actual. Nunca lanza. */
  private async notify(companyId: string, id: string) {
    try {
      const d = await this.ds.getRepository(SriDocument).findOne({
        where: { id, companyId },
        relations: { lines: true },
        order: { lines: { position: 'ASC' } },
      });
      if (!d) return;
      await this.broadcast.publishInvoiceUpdated({
        company_id: d.companyId,
        id: d.id,
        documentTypeCode: d.documentTypeCode,
        series: d.series,
        sequence: d.sequence,
        buyerName: d.buyerName,
        buyerIdNumber: d.buyerIdNumber,
        issueDate: d.issueDate,
        createdAt: d.createdAt,
        total: d.total,
        statusCode: d.statusCode,
        lastErrorMessage: d.lastErrorMessage ?? null,
        buyerEmail: d.buyerEmail,
        subtotal: d.subtotal,
        totalDiscount: d.totalDiscount,
        vatValue: d.vatValue,
        lines: d.lines,
      });
    } catch (e: any) {
      this.logger.warn(`notify falló: ${e?.message}`);
    }
  }

  async findOne(companyId: string, id: string) {
    const doc = await this.ds.getRepository(SriDocument).findOne({
      where: { id, companyId },
      relations: { lines: true, payments: true },
      order: { lines: { position: 'ASC' } },
    });
    if (!doc) throw new BadRequestException('Documento no encontrado.');
    const { xmlUnsigned, xmlSigned, xmlAuthorized, ...rest } = doc;
    return { ...rest, errorInfo: await this.errorInfo(doc.lastErrorCode) };
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
    if (!['DEVUELTO', 'NAT'].includes(doc.statusCode))
      throw new BadRequestException('Solo se corrigen facturas devueltas o no autorizadas.');

    const info = await this.errorInfo(doc.lastErrorCode);
    if (info?.blocked)
      throw new BadRequestException(`No se puede reenviar. Error ${info.code}: ${info.name}. ${info.description}`);

    // NAT: clave nueva con el mismo secuencial. DEVUELTO: misma clave.
    const accessKey = doc.statusCode === 'NAT'
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

    const rates = await this.loadVatRates(
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

    await this.buildAndStoreXml(companyId, id);
    const signed = await this.trySign(companyId, id);
    await this.notify(companyId, id);
    if (signed && process.env.SRI_AUTO_SEND !== 'false') {
      void this.sendInBackground(companyId, id);
    }

    return { id, signed };
  }
}