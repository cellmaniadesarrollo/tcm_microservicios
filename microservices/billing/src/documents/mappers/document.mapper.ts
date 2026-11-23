import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BranchReplica } from '../../companies/entities/branch-replica.entity';
import { Issuer } from '../../issuer/entities/issuer.entity';
import { SriDocument } from '../../sri-documents/entities/sri-document.entity';
import { AnyDoc, DocIssuer, InvoiceDoc } from '../models/document.model';

@Injectable()
export class DocumentMapper {
  constructor(private readonly ds: DataSource) {}

  async load(companyId: string, documentId: string): Promise<AnyDoc> {
    const doc = await this.ds.getRepository(SriDocument).findOne({
      where: { id: documentId, companyId },
      relations: { lines: true, payments: true },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado.');
    if (doc.documentTypeCode !== '01')
      throw new BadRequestException(`Tipo de documento ${doc.documentTypeCode} aún no soportado.`);
    if (!doc.accessKey) throw new BadRequestException('El documento no tiene clave de acceso.');

    const issuer = await this.ds.getRepository(Issuer).findOne({
      where: { id: doc.issuerId, companyId },
    });
    if (!issuer) throw new NotFoundException('Emisor no encontrado.');

    // dirMatriz es obligatorio en infoTributaria: se falla aquí y no en el SRI.
    if (!issuer.headquartersAddress?.trim())
      throw new BadRequestException('El emisor no tiene dirección matriz (dirMatriz).');

    const branch = doc.branchId
      ? await this.ds.getRepository(BranchReplica).findOne({ where: { id: doc.branchId } })
      : null;

    const docIssuer: DocIssuer = {
      ruc: issuer.ruc,
      businessName: issuer.legalName,
      tradeName: issuer.tradeName,
      headOfficeAddress: issuer.headquartersAddress,
      establishmentAddress: branch?.address ?? issuer.headquartersAddress,
      specialTaxpayer: issuer.specialTaxpayer,
      accountingRequired: issuer.accountingRequired,
      withholdingAgent: null, // el emisor aún no guarda este dato
      rimpe: null, // ni este
    };

    const lines = [...doc.lines].sort((a, b) => a.position - b.position);

    const invoice: InvoiceDoc = {
      kind: 'FACTURA',
      environmentCode: doc.environmentCode,
      emissionTypeCode: doc.emissionTypeCode,
      accessKey: doc.accessKey,
      series: doc.series,
      sequence: doc.sequence,
      issueDate: doc.issueDate,
      issuer: docIssuer,
      buyer: {
        idTypeCode: doc.buyerIdTypeCode,
        idNumber: doc.buyerIdNumber,
        name: doc.buyerName,
        address: doc.buyerAddress,
        email: doc.buyerEmail,
      },
      totalWithoutTax: doc.subtotal,
      totalDiscount: doc.totalDiscount,
      tip: doc.tip,
      total: doc.total,
      lines: lines.map((l) => ({
        mainCode: l.mainCode,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        lineTotal: l.lineTotal,
        vatRateCode: l.vatRateCode,
        vatPercentage: l.vatPercentage,
        vatBase: l.vatBase,
        vatAmount: l.vatAmount,
      })),
      payments: doc.payments.map((p) => ({
        methodCode: p.methodCode,
        amount: p.amount,
        term: p.term,
        timeUnit: p.timeUnit,
      })),
    };
    return invoice;
  }
}