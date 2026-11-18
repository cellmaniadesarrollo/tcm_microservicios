import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In, QueryFailedError } from 'typeorm';
import { BranchReplica } from '../../companies/entities/branch-replica.entity';
import { SignatureBranch } from '../../signature/entities/signature-branch.entity';
import { CreateIssuerDto } from '../dto/create-issuer.dto';
import { UpdateIssuerDto } from '../dto/update-issuer.dto';
import { Issuer } from '../entities/issuer.entity';

const up = (s?: string | null) => (s ? s.trim().toUpperCase() : null);

@Injectable()
export class IssuersService {
  constructor(private readonly ds: DataSource) {}

  async create(companyId: string, dto: CreateIssuerDto) {
    try {
      const repo = this.ds.getRepository(Issuer);
      const saved = await repo.save(
        repo.create({
          companyId,
          ruc: dto.ruc.trim(),
          legalName: up(dto.legalName)!,
          tradeName: up(dto.tradeName),
          headquartersAddress: up(dto.headquartersAddress)!,
          specialTaxpayer: dto.specialTaxpayer?.trim() || null,
          accountingRequired: dto.accountingRequired ?? false,
          environment: dto.environment ?? 1,
          emissionType: dto.emissionType ?? 1,
        }),
      );
      return this.toDto(saved);
    } catch (e) {
      if (e instanceof QueryFailedError && (e.driverError as any)?.code === '23505')
        throw new ConflictException('Ya existe un emisor con ese RUC en la empresa.');
      throw e;
    }
  }

  async update(companyId: string, id: string, dto: UpdateIssuerDto) {
    const repo = this.ds.getRepository(Issuer);
    const issuer = await repo.findOne({ where: { id, companyId } });
    if (!issuer) throw new NotFoundException('Emisor no encontrado.');

    if (dto.legalName !== undefined) issuer.legalName = up(dto.legalName)!;
    if (dto.tradeName !== undefined) issuer.tradeName = up(dto.tradeName);
    if (dto.headquartersAddress !== undefined) issuer.headquartersAddress = up(dto.headquartersAddress)!;
    if (dto.specialTaxpayer !== undefined) issuer.specialTaxpayer = dto.specialTaxpayer?.trim() || null;
    if (dto.accountingRequired !== undefined) issuer.accountingRequired = dto.accountingRequired;
    if (dto.environment !== undefined) issuer.environment = dto.environment;
    if (dto.emissionType !== undefined) issuer.emissionType = dto.emissionType;
    if (dto.active !== undefined) issuer.active = dto.active;

    return this.toDto(await repo.save(issuer));
  }

  /** Emisores con las sucursales que salen de sus firmas. */
  async list(companyId: string) {
    const issuers = await this.ds.getRepository(Issuer).find({
      where: { companyId },
      order: { legalName: 'ASC' },
    });

    const links = await this.ds.getRepository(SignatureBranch).find({
      where: { signature: { companyId } },
      relations: { signature: true },
    });
    const branchIds = [...new Set(links.map((l) => l.branchId))];
    const branches = branchIds.length
      ? await this.ds.getRepository(BranchReplica).find({ where: { id: In(branchIds) } })
      : [];
    const byId = new Map(branches.map((b) => [b.id, b]));

    return {
      items: issuers.map((i) => ({
        ...this.toDto(i),
        branches: links
          .filter((l) => l.signature.issuerId === i.id)
          .map((l) => {
            const b = byId.get(l.branchId);
            return {
              id: l.branchId,
              name: b?.name ?? 'Sucursal',
              establishmentCode: b?.code ?? null,
              address: b?.address ?? null,
            };
          }),
      })),
    };
  }

  /** Todo lo que necesita una factura para esa sucursal. */
  async resolveForBranch(companyId: string, branchId: string) {
    const link = await this.ds.getRepository(SignatureBranch).findOne({
      where: { branchId, signature: { companyId, active: true } },
      relations: { signature: true },
    });
    if (!link?.signature.issuerId)
      throw new BadRequestException('La sucursal no tiene firma con emisor asignado.');

    const issuer = await this.ds.getRepository(Issuer).findOne({
      where: { id: link.signature.issuerId, companyId, active: true },
    });
    const branch = await this.ds.getRepository(BranchReplica).findOne({ where: { id: branchId } });
    if (!issuer || !branch) throw new NotFoundException('Emisor o sucursal no encontrados.');
    if (!/^\d{1,3}$/.test(branch.code))
      throw new BadRequestException('El código de la sucursal debe ser numérico de hasta 3 dígitos.');

    return {
      issuer,
      signatureId: link.signatureId,
      establishmentCode: branch.code.padStart(3, '0'),
      establishmentAddress: branch.address,
      emissionPointCode: '001', // pendiente: confirmar si hay varios puntos de emisión
    };
  }

  private toDto(i: Issuer) {
    const { logoKey, ...safe } = i; // la key de S3 no sale
    return { ...safe, hasLogo: !!logoKey };
  }
}