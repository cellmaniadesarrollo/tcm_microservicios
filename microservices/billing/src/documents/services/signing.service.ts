import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AwsS3Service } from '../../aws-s3/aws-s3.service';
import { Signature } from '../../signature/entities/signature.entity';
import { SignatureCryptoService } from '../../signature/services/signature-crypto.service';
import { SriDocument } from '../../sri-documents/entities/sri-document.entity';
import { signXadesBes } from '../helpers/xades-signer.helper';
import { SRI_BUCKET, sriXmlKey } from '../helpers/xml-storage.helper';

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

    // 1) Descargar el .p12 (bucket AWS_BUCKET_NAME)
    let p12: Buffer;
    try {
      p12 = await this.s3.getObjectBuffer(sig.p12Key);
    } catch (e: any) {
      this.logger.error(`No se pudo descargar el .p12 (${sig.p12Key}): ${e?.message}`, e?.stack);
      throw new BadRequestException(`No se pudo descargar el .p12: ${e?.message}`);
    }

    // 2) Descifrar la contraseña
    let password: string;
    try {
      password = this.crypto.decrypt(sig.passwordEnc);
    } catch (e: any) {
      this.logger.error(`No se pudo descifrar la contraseña: ${e?.message}`, e?.stack);
      throw new BadRequestException(
        `No se pudo descifrar la contraseña de la firma (revisa SIGNATURE_ENC_KEY): ${e?.message}`,
      );
    }

    // 3) Firmar
    let signed: string;
    try {
      signed = signXadesBes(doc.xmlUnsigned, p12, password);
    } catch (e: any) {
      this.logger.error(`Falló la firma de ${documentId}: ${e?.message}`, e?.stack);
      throw new BadRequestException(`No se pudo firmar el comprobante: ${e?.message}`);
    }

    await repo.update({ id: doc.id, companyId }, { xmlSigned: signed, statusCode: 'FIRMADO' });

    // 4) S3: FACTURACION/FIRMADOS/<claveAcceso>.xml (si falla, el XML firmado ya está en la base)
    try {
      const key = await this.s3.putObject(
        sriXmlKey.signed(doc.accessKey),
        Buffer.from(signed, 'utf8'),
        'application/xml',
        SRI_BUCKET,
      );
      await repo.update({ id: doc.id, companyId }, { xmlSignedKey: key });
      this.logger.log(`Documento ${documentId} firmado (${signed.length} caracteres) -> s3:${key}`);
    } catch (e: any) {
      this.logger.error(`XML firmado ${documentId} no subió a S3: ${e?.message}`);
      this.logger.log(`Documento ${documentId} firmado (${signed.length} caracteres)`);
    }

    return { id: doc.id, statusCode: 'FIRMADO' };
  }
}