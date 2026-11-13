import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as forge from 'node-forge';
import { AwsS3Service } from '../../aws-s3/aws-s3.service';
import { SignatureCryptoService } from './signature-crypto.service';
import { Signature } from '../entities/signature.entity';
import { SignatureBranch } from '../entities/signature-branch.entity';

@Injectable()
export class SignaturesService {
  constructor(
    private readonly ds: DataSource,
    private readonly s3: AwsS3Service,
    private readonly crypto: SignatureCryptoService,
  ) {}

  private readP12(buffer: Buffer, password: string) {
    try {
      const der = forge.util.createBuffer(buffer.toString('binary'));
      const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), password);
      const bags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
      const certs = bags.map(b => b.cert).filter(Boolean) as forge.pki.Certificate[];
      if (!certs.length) throw new Error('sin certificado');
      // el que vence primero suele ser el de la persona, no el de la CA
      const cert = certs.sort((a, b) => a.validity.notAfter.getTime() - b.validity.notAfter.getTime())[0];
      const cn = cert.subject.getField('CN')?.value as string | undefined;
      return { subject: cn ?? 'Sin titular', expiresAt: cert.validity.notAfter };
    } catch {
      throw new BadRequestException('El archivo .p12 no es válido o la clave es incorrecta.');
    }
  }

  async create(
    companyId: string,
    file: { buffer: Buffer; originalname: string },
    password: string,
    branchIds: string[],
    clientRequestId: string,
  ) {
    // idempotencia
    const prev = await this.ds.getRepository(Signature).findOne({ where: { clientRequestId, companyId } });
    if (prev) return { ...this.toDto(prev), replayed: true };

    const { subject, expiresAt } = this.readP12(file.buffer, password); // 1) valida ANTES de subir
    if (expiresAt < new Date()) throw new BadRequestException('La firma está vencida.');

    const taken = await this.ds.getRepository(SignatureBranch).createQueryBuilder('sb')
      .where('sb.branchId IN (:...ids)', { ids: branchIds }).getMany();
    if (taken.length) throw new ConflictException('Alguna sucursal ya tiene una firma asignada.');

    const p12Key = await this.s3.uploadBuffer(          // 2) sube antes de la transacción
      file.buffer, file.originalname, 'application/x-pkcs12', `signatures/${companyId}/`,
    );
    try {
      return await this.ds.transaction(async m => {     // 3) transacción
        const sig = await m.save(Signature, {
          companyId, subject, expiresAt, p12Key,
          passwordEnc: this.crypto.encrypt(password), clientRequestId,
        });
        await m.save(SignatureBranch, branchIds.map(branchId => ({ signature: sig, branchId })));
        return { ...this.toDto(sig), branchIds, replayed: false };
      });
    } catch (e) {
      await this.s3.deleteObject(p12Key);               // 4) limpieza (no lanza)
      throw e;
    }
  }

  private toDto(s: Signature) {
    const { passwordEnc, p12Key, ...safe } = s; // la clave y la key de S3 no salen
    return safe;
  }
}