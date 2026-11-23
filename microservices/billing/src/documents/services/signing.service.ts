import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AwsS3Service } from '../../aws-s3/aws-s3.service';
import { Signature } from '../../signature/entities/signature.entity';
import { SignatureCryptoService } from '../../signature/services/signature-crypto.service';
import { SriDocument } from '../../sri-documents/entities/sri-document.entity';
import { signXadesBes } from '../helpers/xades-signer.helper';
import { xmlPrefix } from '../helpers/xml-storage.helper';

@Injectable()
export class SigningService {
  private readonly logger = new Logger(SigningService.name);

  constructor(
    private readonly ds: DataSource,
    private readonly s3: AwsS3Service,
    private readonly crypto: SignatureCryptoService,
  ) {}

  /** Firma el XML guardado del documento y pasa el estado a FIRMADO. */
  async signDocument(companyId: string, documentId: string) {
    const repo = this.ds.getRepository(SriDocument);
    const doc = await repo.findOne({ where: { id: documentId, companyId } });
    if (!doc) throw new NotFoundException('Documento no encontrado.');
    if (!doc.xmlUnsigned) throw new BadRequestException('El documento no tiene XML generado.');
    if (!doc.signatureId) throw new BadRequestException('El documento no tiene firma asignada.');
    if (doc.statusCode !== 'BORRADOR')
      throw new BadRequestException(`El documento está en estado ${doc.statusCode}.`);

    const sig = await this.ds.getRepository(Signature).findOne({
      where: { id: doc.signatureId, companyId, active: true },
    });
    if (!sig) throw new NotFoundException('Firma no encontrada o inactiva.');
    if (sig.expiresAt < new Date()) throw new BadRequestException('La firma está vencida.');

    const p12 = await this.s3.getObjectBuffer(sig.p12Key);
    const password = this.crypto.decrypt(sig.passwordEnc);

    let signed: string;
    try {
      signed = signXadesBes(doc.xmlUnsigned, p12, password);
    } catch (e: any) {
      this.logger.error(`Falló la firma de ${documentId}: ${e?.message}`, e?.stack);
      throw new BadRequestException('No se pudo firmar el comprobante.');
    }

    await repo.update({ id: doc.id, companyId }, { xmlSigned: signed, statusCode: 'FIRMADO' });

    // S3: si falla, el XML firmado ya está en la base
    try {
      const key = await this.s3.uploadBuffer(
        Buffer.from(signed, 'utf8'),
        `${doc.accessKey}.xml`,
        'application/xml',
        xmlPrefix(companyId, doc.issueDate, 'signed'),
      );
      await repo.update({ id: doc.id, companyId }, { xmlSignedKey: key });
    } catch (e: any) {
      this.logger.error(`XML firmado ${documentId} no subió a S3: ${e?.message}`);
    }

    this.logger.log(`Documento ${documentId} firmado (${signed.length} caracteres)`);
    return { id: doc.id, statusCode: 'FIRMADO' };
  }
}