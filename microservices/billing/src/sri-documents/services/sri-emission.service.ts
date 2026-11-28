import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AwsS3Service } from '../../aws-s3/aws-s3.service';
import { BroadcastService } from '../../broadcast/service/broadcast.service';
import { saveDebugXml } from '../../documents/helpers/xml-file.helper';
import { SRI_BUCKET, sriXmlKey } from '../../documents/helpers/xml-storage.helper';
import { DocumentsService } from '../../documents/services/documents.service';
import { SigningService } from '../../documents/services/signing.service';
import { SriSubmissionService } from '../../documents/services/sri-submission.service';
import { SriDocument } from '../entities/sri-document.entity';

@Injectable()
export class SriEmissionService {
  private readonly logger = new Logger(SriEmissionService.name);

  constructor(
    private readonly ds: DataSource,
    private readonly documents: DocumentsService,
    private readonly s3: AwsS3Service,
    private readonly signing: SigningService,
    private readonly submission: SriSubmissionService,
    private readonly broadcast: BroadcastService,
  ) {}

  /** XML -> firma -> aviso en vivo -> envío al SRI en segundo plano. Nunca lanza. */
  async finalize(companyId: string, documentId: string): Promise<boolean> {
    await this.buildAndStoreXml(companyId, documentId);
    const signed = await this.trySign(companyId, documentId);
    await this.notify(companyId, documentId);
    if (signed && process.env.SRI_AUTO_SEND !== 'false') {
      void this.sendInBackground(companyId, documentId);
    }
    return signed;
  }

  /** Documento sin los XML pesados, con el estado actual. */
  async fresh(companyId: string, documentId: string) {
    const d = await this.ds.getRepository(SriDocument).findOne({
      where: { id: documentId, companyId },
      relations: { lines: true, payments: true },
      order: { lines: { position: 'ASC' } },
    });
    if (!d) return null;
    const { xmlUnsigned, xmlSigned, xmlAuthorized, ...rest } = d as any;
    return rest;
  }

  async buildAndStoreXml(companyId: string, documentId: string) {
    try {
      const xml = (await this.documents.render(companyId, documentId, 'SRI_XML')) as string;
      const repo = this.ds.getRepository(SriDocument);
      await repo.update({ id: documentId, companyId }, { xmlUnsigned: xml });

      const doc = await repo.findOne({
        where: { id: documentId, companyId },
        select: { accessKey: true },
      });
      const accessKey = doc?.accessKey ?? documentId;

      const path = await saveDebugXml(`${accessKey}.xml`, xml);

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

  async trySign(companyId: string, documentId: string): Promise<boolean> {
    try {
      await this.signing.signDocument(companyId, documentId);
      return true;
    } catch (e: any) {
      this.logger.error(`No se pudo firmar ${documentId}: ${e?.message}`, e?.stack);
      return false;
    }
  }

  async sendInBackground(companyId: string, documentId: string) {
    try {
      const res = await this.submission.send(companyId, documentId);
      this.logger.log(`Envío SRI de ${documentId}: ${res.statusCode}`);
    } catch (e: any) {
      this.logger.error(`No se pudo enviar ${documentId} al SRI: ${e?.message}`, e?.stack);
    }
  }

  async notify(companyId: string, id: string) {
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

  /** Continúa desde donde quedó: XML -> firma -> envío. Se puede repetir sin riesgo. */
  async retry(companyId: string, documentId: string) {
    const repo = this.ds.getRepository(SriDocument);
    const doc = await repo.findOne({ where: { id: documentId, companyId } });
    if (!doc) throw new NotFoundException('Documento no encontrado.');

    if (doc.statusCode === 'AUT')
      return { id: doc.id, statusCode: 'AUT', authorizationNumber: doc.authorizationNumber };
    if (!['BORRADOR', 'FIRMADO', 'RECIBIDO', 'PPR'].includes(doc.statusCode))
      throw new BadRequestException(
        `Un documento en estado ${doc.statusCode} no se reintenta así. Usa "Corregir y reenviar".`,
      );

    // 1) Sin firmar: genera XML y firma
    if (doc.statusCode === 'BORRADOR') {
      await this.buildAndStoreXml(companyId, documentId);
      const signed = await this.trySign(companyId, documentId);
      if (!signed) {
        await this.notify(companyId, documentId);
        throw new BadRequestException('No se pudo firmar el documento. Revisa la firma electrónica.');
      }
    }

    // 2) Envío al SRI (espera la respuesta; el usuario pulsó el botón)
    const res = await this.submission.send(companyId, documentId);
    await this.notify(companyId, documentId);
    return res;
  }
}