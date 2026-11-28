import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StockClientService } from '../../documents/services/stock-client.service';
import { IssuersService } from '../../issuer/services/issuers.service';
import { CreateCreditNoteDto } from '../dto/create-credit-note.dto';
import { SriDocumentLine } from '../entities/sri-document-line.entity';
import { SriDocument } from '../entities/sri-document.entity';
import { buildAccessKey } from '../helpers/access-key.helper';
import { calculateTotals, LineInput } from '../helpers/totals.helper';
import { SriEmissionService } from './sri-emission.service';
import { SriSequenceService } from './sri-sequence.service';
import { VatRatesService } from './vat-rates.service';

const EPS = 0.0000005;

@Injectable()
export class CreditNotesService {
  constructor(
    private readonly ds: DataSource,
    private readonly issuers: IssuersService,
    private readonly sequences: SriSequenceService,
    private readonly vatRates: VatRatesService,
    private readonly emission: SriEmissionService,
    private readonly stock: StockClientService,
  ) {}

  async create(companyId: string, _userId: string, dto: CreateCreditNoteDto) {
    // idempotencia
    const prev = await this.ds.getRepository(SriDocument).findOne({
      where: { companyId, clientRequestId: dto.clientRequestId },
      relations: { lines: true },
    });
    if (prev) {
      const { xmlUnsigned, xmlSigned, xmlAuthorized, ...rest } = prev as any;
      return { ...rest, replayed: true };
    }

    const createdId = await this.ds.transaction(async (m) => {
      // Bloqueo la factura para que dos NC simultáneas no devuelvan lo mismo
      const inv = await m.findOne(SriDocument, {
        where: { id: dto.modifiedDocumentId, companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!inv) throw new BadRequestException('Factura no encontrada.');
      if (inv.documentTypeCode !== '01')
        throw new BadRequestException('Solo se emite NC sobre facturas.');
      if (inv.statusCode !== 'AUT')
        throw new BadRequestException('La factura debe estar autorizada por el SRI.');
      if (dto.issueDate < inv.issueDate)
        throw new BadRequestException('La fecha de la NC no puede ser anterior a la factura.');

      const invLines = await m.find(SriDocumentLine, {
        where: { documentId: inv.id },
        order: { position: 'ASC' },
      });

      // Ya devuelto por otras NC (excluye las rechazadas o devueltas por el SRI)
      const prior = await m
        .getRepository(SriDocumentLine)
        .createQueryBuilder('l')
        .innerJoin('l.document', 'd')
        .select('l.source_line_id', 'sid')
        .addSelect('SUM(l.quantity)', 'qty')
        .where('d.modifiedDocumentId = :id', { id: inv.id })
        .andWhere("d.statusCode NOT IN ('NAT', 'DEVUELTO')")
        .groupBy('l.source_line_id')
        .getRawMany<{ sid: string; qty: string }>();
      const credited = new Map(prior.map((p) => [p.sid, Number(p.qty)]));
      const pending = (l: SriDocumentLine) => Number(l.quantity) - (credited.get(l.id) ?? 0);

      // Qué se devuelve
      const picks = dto.lines?.length
        ? dto.lines
        : invLines
            .filter((l) => pending(l) > EPS)
            .map((l) => ({ sourceLineId: l.id, quantity: pending(l) }));
      if (!picks.length) throw new BadRequestException('No hay nada pendiente de devolver.');

      const rates = await this.vatRates.load(invLines.map((l) => l.vatRateCode));
      const lineInputs: LineInput[] = [];
      const sourceIds: string[] = [];

      for (const p of picks) {
        const src = invLines.find((l) => l.id === p.sourceLineId);
        if (!src) throw new BadRequestException('Una línea no pertenece a la factura.');
        if (p.quantity <= 0 || p.quantity - pending(src) > EPS)
          throw new BadRequestException(
            `Línea ${src.position}: cantidad pendiente de devolver ${pending(src)}.`,
          );
        const rate = rates.get(src.vatRateCode);
        if (!rate) throw new BadRequestException(`Tarifa de IVA no válida: ${src.vatRateCode}`);

        // descuento proporcional a lo devuelto
        const disc = (Number(src.discount) * p.quantity) / Number(src.quantity);

        lineInputs.push({
          productId: src.productId ?? undefined,
          lotId: src.lotId ?? undefined,
          unitId: src.unitId ?? undefined,
          mainCode: src.mainCode,
          description: src.description,
          quantity: p.quantity,
          unitPrice: Number(src.unitPrice),
          discount: Math.round(disc * 100) / 100,
          vatRateCode: src.vatRateCode,
          vatPercentage: rate.percentage,
          vatKind: rate.kind,
        });
        sourceIds.push(src.id);
      }

      const t = calculateTotals(lineInputs, { tip: 0 });
      if (Number(t.total) <= 0)
        throw new BadRequestException('El total de la NC debe ser mayor a cero.');

      const { issuer, signatureId } = await this.issuers.resolveIssuerForBranch(
        companyId,
        inv.branchId!,
      );
      if (issuer.id !== inv.issuerId)
        throw new BadRequestException('El emisor de la sucursal ya no corresponde al de la factura.');

      const series = inv.series; // misma serie de la factura
      const sequence = await this.sequences.next(
        { companyId, issuerId: inv.issuerId, documentTypeCode: '04', series },
        m,
      );
      const accessKey = buildAccessKey({
        issueDate: dto.issueDate,
        documentTypeCode: '04',
        ruc: issuer.ruc,
        environmentCode: String(issuer.environment),
        series,
        sequence,
      });

      const doc = await m.save(SriDocument, {
        companyId,
        issuerId: inv.issuerId,
        signatureId,
        branchId: inv.branchId,
        orderId: inv.orderId,
        documentTypeCode: '04',
        environmentCode: String(issuer.environment),
        emissionTypeCode: String(issuer.emissionType),
        statusCode: 'BORRADOR',
        series,
        sequence,
        accessKey,
        issueDate: dto.issueDate,
        buyerIdTypeCode: inv.buyerIdTypeCode,
        buyerIdNumber: inv.buyerIdNumber,
        buyerName: inv.buyerName,
        buyerAddress: inv.buyerAddress,
        buyerEmail: inv.buyerEmail,
        subtotalVat: t.subtotalVat,
        subtotalZero: t.subtotalZero,
        subtotalNotObject: t.subtotalNotObject,
        subtotalExempt: t.subtotalExempt,
        subtotal: t.subtotal,
        totalDiscount: t.totalDiscount,
        iceValue: t.iceValue,
        vatValue: t.vatValue,
        tip: '0.00',
        total: t.total,
        modifiedDocumentId: inv.id,
        reason: dto.reason.trim(),
        clientRequestId: dto.clientRequestId,
        // el stock se reingresa solo cuando el SRI autorice la NC (ver SriSubmissionService)
        stockState: this.stock.buildLines(t.lines).length ? 'TO_RETURN' : 'NONE',
        lines: t.lines.map((l, i) => ({ ...l, sourceLineId: sourceIds[i] })),
        payments: [],
      });

      return doc.id;
    });

    await this.emission.finalize(companyId, createdId);
    const fresh = await this.emission.fresh(companyId, createdId);
    return { ...fresh, replayed: false };
  }
}