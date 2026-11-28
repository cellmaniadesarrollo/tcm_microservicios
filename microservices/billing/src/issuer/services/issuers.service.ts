import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In, QueryFailedError } from 'typeorm';
import { BranchReplica } from '../../companies/entities/branch-replica.entity';
import { SignatureBranch } from '../../signature/entities/signature-branch.entity';
import { CreateIssuerDto } from '../dto/create-issuer.dto';
import { UpdateIssuerDto } from '../dto/update-issuer.dto';
import { EmissionPoint } from '../entities/emission-point.entity';
import { Issuer } from '../entities/issuer.entity';
import { EmissionPointUser } from '../entities/emission-point-user.entity';

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
  async resolveForBranch(companyId: string, branchId: string, userId: string, emissionPointId?: string) {
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

    const point = await this.resolveEmissionPoint(companyId, branchId, userId, emissionPointId);

    return {
      issuer,
      signatureId: link.signatureId,
      establishmentCode: branch.code.padStart(3, '0'),
      establishmentAddress: branch.address,
      emissionPointId: point.id,
      emissionPointCode: point.code.padStart(3, '0'),
    };
  }

  /** Puntos activos asignados al usuario en la sucursal (vacío = sin restricción). */
  private async assignedPoints(companyId: string, branchId: string, userId: string) {
    const links = await this.ds.getRepository(EmissionPointUser).find({ where: { companyId, userId } });
    if (!links.length) return [];
    return this.ds.getRepository(EmissionPoint).find({
      where: { id: In(links.map((l) => l.emissionPointId)), branchId, companyId, active: true },
      order: { code: 'ASC' },
    });
  }

  /** Punto indicado, o el por defecto de la sucursal. Si no existe ninguno, crea el 001. */
  private async resolveEmissionPoint(
    companyId: string,
    branchId: string,
    userId: string,
    emissionPointId?: string,
  ) {
    const repo = this.ds.getRepository(EmissionPoint);
    const assigned = await this.assignedPoints(companyId, branchId, userId);

    if (emissionPointId) {
      if (assigned.length) {
        const p = assigned.find((x) => x.id === emissionPointId);
        if (!p) throw new BadRequestException('No tienes asignado ese punto de emisión.');
        return p;
      }
      const p = await repo.findOne({ where: { id: emissionPointId, branchId, companyId, active: true } });
      if (!p) throw new BadRequestException('El punto de emisión indicado no es válido.');
      return p;
    }

    if (assigned.length) return assigned.find((x) => x.isDefault) ?? assigned[0];

    let point = await repo.findOne({ where: { branchId, companyId, active: true, isDefault: true } });
    if (!point) {
      try {
        point = await repo.save(
          repo.create({ companyId, branchId, code: '001', name: 'Caja principal', isDefault: true }),
        );
      } catch {
        point = await repo.findOne({ where: { branchId, companyId, isDefault: true } });
      }
    }
    if (!point) throw new BadRequestException('La sucursal no tiene punto de emisión.');
    return point;
  }

  /** Puntos que este usuario puede usar en la sucursal (para el selector de la venta). */
  async listMyEmissionPoints(companyId: string, branchId: string, userId: string) {
    const assigned = await this.assignedPoints(companyId, branchId, userId);
    if (assigned.length) return { items: assigned, restricted: true };
    const items = await this.ds.getRepository(EmissionPoint).find({
      where: { companyId, branchId, active: true },
      order: { code: 'ASC' },
    });
    return { items, restricted: false };
  }

  /** IDs de usuario asignados a un punto. */
  async getEmissionPointUsers(companyId: string, emissionPointId: string) {
    const rows = await this.ds.getRepository(EmissionPointUser).find({ where: { companyId, emissionPointId } });
    return { userIds: rows.map((r) => r.userId) };
  }

  /** Reemplaza el conjunto completo de usuarios del punto. Lista vacía es válida. */
  async setEmissionPointUsers(companyId: string, emissionPointId: string, userIds: string[]) {
    const unique = [...new Set(userIds)];
    return this.ds.transaction(async (m) => {
      const point = await m.getRepository(EmissionPoint).findOne({ where: { id: emissionPointId, companyId } });
      if (!point) throw new NotFoundException('Punto de emisión no encontrado.');

      const repo = m.getRepository(EmissionPointUser);
      await repo.delete({ companyId, emissionPointId });
      if (unique.length)
        await repo.insert(unique.map((userId) => ({ companyId, emissionPointId, userId })));
      return { userIds: unique };
    });
  }

  async listEmissionPoints(companyId: string, branchId: string) {
    const items = await this.ds.getRepository(EmissionPoint).find({
      where: { companyId, branchId },
      order: { code: 'ASC' },
    });
    return { items };
  }

  async createEmissionPoint(companyId: string, branchId: string, dto: { code: string; name: string }) {
    if (!/^\d{1,3}$/.test(dto.code ?? ''))
      throw new BadRequestException('El código debe ser numérico de hasta 3 dígitos.');
    if (!dto.name?.trim()) throw new BadRequestException('El nombre es obligatorio.');

    const repo = this.ds.getRepository(EmissionPoint);
    const hasAny = await repo.count({ where: { companyId, branchId } });
    try {
      return await repo.save(
        repo.create({
          companyId,
          branchId,
          code: dto.code.padStart(3, '0'),
          name: dto.name.trim(),
          isDefault: hasAny === 0,
        }),
      );
    } catch (e) {
      if (e instanceof QueryFailedError && (e.driverError as any)?.code === '23505')
        throw new ConflictException('Ya existe un punto de emisión con ese código en la sucursal.');
      throw e;
    }
  }

  async updateEmissionPoint(
    companyId: string,
    id: string,
    dto: { name?: string; active?: boolean; isDefault?: boolean },
  ) {
    return this.ds.transaction(async (m) => {
      const repo = m.getRepository(EmissionPoint);
      const p = await repo.findOne({ where: { id, companyId } });
      if (!p) throw new NotFoundException('Punto de emisión no encontrado.');

      if (dto.name !== undefined) {
        if (!dto.name.trim()) throw new BadRequestException('El nombre es obligatorio.');
        p.name = dto.name.trim();
      }
      if (dto.active === false && p.isDefault)
        throw new BadRequestException('No puedes desactivar el punto principal. Define otro primero.');
      if (dto.active !== undefined) p.active = dto.active;

      if (dto.isDefault === true && !p.isDefault) {
        if (!p.active) throw new BadRequestException('Activa el punto antes de hacerlo principal.');
        await repo.update({ branchId: p.branchId, companyId, isDefault: true }, { isDefault: false });
        p.isDefault = true;
      }
      return repo.save(p);
    });
  }

  private toDto(i: Issuer) {
    const { logoKey, ...safe } = i; // la key de S3 no sale
    return { ...safe, hasLogo: !!logoKey };
  }

  /** Emisor y firma de la sucursal, sin tocar puntos de emisión. */
  async resolveIssuerForBranch(companyId: string, branchId: string) {
    const link = await this.ds.getRepository(SignatureBranch).findOne({
      where: { branchId, signature: { companyId, active: true } },
      relations: { signature: true },
    });
    if (!link?.signature.issuerId)
      throw new BadRequestException('La sucursal no tiene firma con emisor asignado.');

    const issuer = await this.ds.getRepository(Issuer).findOne({
      where: { id: link.signature.issuerId, companyId, active: true },
    });
    if (!issuer) throw new NotFoundException('Emisor no encontrado.');
    return { issuer, signatureId: link.signatureId };
  }
}