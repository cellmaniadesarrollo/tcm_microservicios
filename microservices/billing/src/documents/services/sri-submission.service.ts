import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AwsS3Service } from '../../aws-s3/aws-s3.service';
import { SriDocument } from '../../sri-documents/entities/sri-document.entity';
import { SriEnvironment } from '../../sri-catalogs/entities/sri-environment.entity';
import { SRI_BUCKET, sriXmlKey } from '../helpers/xml-storage.helper';
import { SriClientService, SriMessage } from './sri-client.service';
import { StockClientService } from './stock-client.service';

const ST = {
  RECEIVED: 'RECIBIDO',
  PENDING: 'PPR',
  AUTHORIZED: 'AUT',
  NOT_AUTHORIZED: 'NAT',
  RETURNED: 'DEVUELTO',
} as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Mensajes del SRI -> columnas de error (código de 4 chars + texto completo). */
const errorFields = (msgs: SriMessage[]) => ({
  lastErrorCode: msgs[0]?.id?.slice(0, 4) ?? null,
  lastErrorMessage: msgs.length
    ? msgs.map((m) => `[${m.id}] ${m.message}${m.extra ? ` - ${m.extra}` : ''}`).join(' | ')
    : null,
});

@Injectable()
export class SriSubmissionService {
  private readonly logger = new Logger(SriSubmissionService.name);

  constructor(
    private readonly ds: DataSource,
    private readonly s3: AwsS3Service,
    private readonly sri: SriClientService,
    private readonly stock: StockClientService,
  ) {}

  /** Envía al SRI y consulta la autorización. Se puede repetir sin riesgo. */
  async send(companyId: string, documentId: string) {
    const repo = this.ds.getRepository(SriDocument);
    const doc = await repo.findOne({ where: { id: documentId, companyId } });
    if (!doc) throw new NotFoundException('Documento no encontrado.');
    if (!doc.xmlSigned) throw new BadRequestException('El documento no está firmado.');
    if (!doc.accessKey) throw new BadRequestException('El documento no tiene clave de acceso.');
    if (doc.statusCode === ST.AUTHORIZED)
      return { id: doc.id, statusCode: doc.statusCode, authorizationNumber: doc.authorizationNumber };

    const envRow = await this.ds
      .getRepository(SriEnvironment)
      .findOne({ where: { code: doc.environmentCode } });
    if (!envRow?.receptionUrl || !envRow?.authorizationUrl)
      throw new BadRequestException(`Ambiente SRI sin URLs configuradas (${doc.environmentCode}).`);

    await repo.update({ id: doc.id, companyId }, { attempts: () => 'attempts + 1' });

    // 1) Recepción (se omite si ya fue recibida y solo falta autorizar)
    const alreadyReceived = doc.statusCode === ST.RECEIVED || doc.statusCode === ST.PENDING;
    if (!alreadyReceived) {
      let rec;
      try {
        rec = await this.sri.receive(envRow.receptionUrl, doc.xmlSigned);
      } catch (e: any) {
        this.logger.error(`SRI recepción no respondió: ${e?.message}`);
        throw new BadRequestException(`El SRI no respondió: ${e?.message}`);
      }

      // 43 = clave ya registrada, 70 = en procesamiento: se sigue a autorización.
      const continueToAuth = rec.messages.some((m) => m.id === '43' || m.id === '70');
      if (rec.state !== 'RECIBIDA' && !continueToAuth) {
        await repo.update(
          { id: doc.id, companyId },
          { statusCode: ST.RETURNED, ...errorFields(rec.messages) },
        );
        this.logger.warn(`Documento ${doc.id} DEVUELTO: ${JSON.stringify(rec.messages)}`);
        return { id: doc.id, statusCode: ST.RETURNED, messages: rec.messages };
      }
      await repo.update(
        { id: doc.id, companyId },
        { statusCode: ST.RECEIVED, lastErrorCode: null, lastErrorMessage: null },
      );
    }

    // 2) Autorización: hasta 4 consultas, 2 s entre cada una
    for (let i = 0; i < 4; i++) {
      await sleep(2000);
      const a = await this.sri.authorize(envRow.authorizationUrl, doc.accessKey);
      if (!a.state) continue; // el SRI aún no la procesó

      if (a.state === 'AUTORIZADO') {
        let key: string | null = null;
        try {
          key = await this.s3.putObject(
            sriXmlKey.authorized(doc.accessKey),
            Buffer.from(a.xml ?? '', 'utf8'),
            'application/xml',
            SRI_BUCKET,
          );
        } catch (e: any) {
          this.logger.error(`XML autorizado no subió a S3: ${e?.message}`);
        }
        await repo.update(
          { id: doc.id, companyId },
          {
            statusCode: ST.AUTHORIZED,
            authorizationNumber: a.number ?? null,
            authorizedAt: a.date ? new Date(a.date) : new Date(),
            xmlAuthorized: a.xml ?? null,
            xmlAuthorizedKey: key,
            lastErrorCode: null,
            lastErrorMessage: null,
            nextRetryAt: null,
          },
        );
        this.logger.log(`Documento ${doc.id} AUTORIZADO (${a.number})`);
        return { id: doc.id, statusCode: ST.AUTHORIZED, authorizationNumber: a.number };
      }

      await repo.update(
        { id: doc.id, companyId },
        { statusCode: ST.NOT_AUTHORIZED, ...errorFields(a.messages) },
      );
      await this.stock.giveBack(companyId, doc.id);
      this.logger.warn(`Documento ${doc.id} NO AUTORIZADO: ${JSON.stringify(a.messages)}`);
      return { id: doc.id, statusCode: ST.NOT_AUTHORIZED, messages: a.messages };
    }

    // Sigue en procesamiento: PPR; se reintenta con el mismo endpoint
    await repo.update({ id: doc.id, companyId }, { statusCode: ST.PENDING });
    return { id: doc.id, statusCode: ST.PENDING, pending: true };
  }
}