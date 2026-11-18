import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import * as forge from 'node-forge';
import { AwsS3Service } from '../../aws-s3/aws-s3.service';
import { SignatureCryptoService } from './signature-crypto.service';
import { Signature } from '../entities/signature.entity';
import { SignatureBranch } from '../entities/signature-branch.entity';
import { BranchReplica } from '../../companies/entities/branch-replica.entity';
import { Issuer } from '../../issuer/entities/issuer.entity';

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
    issuerId: string | null,
  ) {
    // idempotencia
    const prev = await this.ds.getRepository(Signature).findOne({ where: { clientRequestId, companyId } });
    if (prev) return { ...this.toDto(prev), replayed: true };
    if (issuerId) {
      const issuer = await this.ds.getRepository(Issuer).findOne({
        where: { id: issuerId, companyId, active: true },
      });
      if (!issuer) throw new BadRequestException('Emisor no válido.');
    }

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
          passwordEnc: this.crypto.encrypt(password), clientRequestId, issuerId: issuerId ?? null,
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

  async list(companyId: string) {
    const signatures = await this.ds.getRepository(Signature).find({
      where: { companyId },
      relations: { branches: true },
      order: { createdAt: 'DESC' },
    });

    const branchIds = [...new Set(signatures.flatMap((s) => s.branches.map((b) => b.branchId)))];
    const names = new Map<string, string>();
    if (branchIds.length) {
      const rows = await this.ds.getRepository(BranchReplica).find({ where: { id: In(branchIds) } });
      rows.forEach((b) => names.set(b.id, b.name));
    }

    return {
      items: signatures.map((s) => ({
        id: s.id,
        subject: s.subject,
        issuerId: s.issuerId,
        expiresAt: s.expiresAt,
        active: s.active,
        createdAt: s.createdAt,
        branches: s.branches.map((b) => ({ id: b.branchId, name: names.get(b.branchId) ?? 'Sucursal' })),
      })),
    };
  }

  async getNewData(companyId: string) {
    const branches = await this.ds.getRepository(BranchReplica).find({
      where: { company: { id: companyId }, status: true },
      order: { name: 'ASC' },
    });

    const assigned = await this.ds.getRepository(SignatureBranch).find({
      where: { signature: { companyId } },
      relations: { signature: true },
    });
    const byBranch = new Map(assigned.map((a) => [a.branchId, a.signature]));

    return {
      branches: branches.map((b) => {
        const sig = byBranch.get(b.id);
        return {
          id: b.id,
          name: b.name,
          signature: sig ? { id: sig.id, subject: sig.subject } : null,
        };
      }),
    };
  }

  async updateBranches(companyId: string, id: string, branchIds: string[]) {
    const ids = [...new Set(branchIds)];
    const sig = await this.ds.getRepository(Signature).findOne({ where: { id, companyId } });
    if (!sig) throw new NotFoundException('Firma no encontrada.');

    // las sucursales deben ser de la empresa
    if (ids.length) {
      const valid = await this.ds.getRepository(BranchReplica).count({
        where: { id: In(ids), company: { id: companyId } },
      });
      if (valid !== ids.length) throw new BadRequestException('Alguna sucursal no es válida.');
    }

    await this.ds.transaction(async (m) => {
      const current = await m.find(SignatureBranch, { where: { signatureId: id } });
      const currentIds = current.map((c) => c.branchId);

      const toRemove = currentIds.filter((b) => !ids.includes(b));
      const toAdd = ids.filter((b) => !currentIds.includes(b));

      if (toAdd.length) {
        const taken = await m.find(SignatureBranch, { where: { branchId: In(toAdd) } });
        if (taken.length) throw new ConflictException('Alguna sucursal ya tiene otra firma asignada.');
      }
      if (toRemove.length) await m.delete(SignatureBranch, { signatureId: id, branchId: In(toRemove) });
      if (toAdd.length) await m.save(SignatureBranch, toAdd.map((branchId) => ({ signatureId: id, branchId })));
    });

    const { items } = await this.list(companyId);
    return items.find((i) => i.id === id);
  }

  async updateIssuer(companyId: string, id: string, issuerId: string | null) {
    const repo = this.ds.getRepository(Signature);
    const sig = await repo.findOne({ where: { id, companyId } });
    if (!sig) throw new NotFoundException('Firma no encontrada.');

    if (issuerId) {
      const issuer = await this.ds.getRepository(Issuer).findOne({
        where: { id: issuerId, companyId, active: true },
      });
      if (!issuer) throw new BadRequestException('Emisor no válido.');
    }

    sig.issuerId = issuerId;
    await repo.save(sig);

    const { items } = await this.list(companyId);
    return items.find((i) => i.id === id);
  }
}