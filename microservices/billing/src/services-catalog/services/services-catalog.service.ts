import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceEntity } from '../entities/service.entity';
import { ServiceTypeEntity } from '../entities/service-type.entity';
import {
  CreateServiceDto, CreateServiceTypeDto, ListServicesDto, SetActiveDto,
  UpdateServiceDto, UpdateServiceTypeDto,
} from '../dto/service-catalog.dto';

@Injectable()
export class ServicesCatalogService {
  constructor(
    @InjectRepository(ServiceTypeEntity) private readonly types: Repository<ServiceTypeEntity>,
    @InjectRepository(ServiceEntity) private readonly services: Repository<ServiceEntity>,
  ) {}

  // ---------- Tipos ----------
  async createType(dto: CreateServiceTypeDto) {
    const exists = await this.types.findOne({
      where: { companyId: dto.companyId, name: dto.name.trim() },
    });
    if (exists) throw new ConflictException('Ya existe un tipo con ese nombre');
    return this.types.save(
      this.types.create({ ...dto, name: dto.name.trim(), description: dto.description ?? null }),
    );
  }

  listTypes(companyId: string, onlyActive = false) {
    return this.types.find({
      where: { companyId, ...(onlyActive ? { isActive: true } : {}) },
      order: { name: 'ASC' },
    });
  }

  async updateType(dto: UpdateServiceTypeDto) {
    const t = await this.getType(dto.companyId, dto.id);
    if (dto.name !== undefined) t.name = dto.name.trim();
    if (dto.description !== undefined) t.description = dto.description;
    return this.types.save(t);
  }

  async setTypeActive(dto: SetActiveDto) {
    const t = await this.getType(dto.companyId, dto.id);
    t.isActive = dto.isActive;
    return this.types.save(t);
  }

  // ---------- Servicios ----------
  async create(dto: CreateServiceDto) {
    const type = await this.getType(dto.companyId, dto.serviceTypeId);
    if (!type.isActive) {
      throw new BadRequestException('El tipo de servicio está inactivo');
    }
    this.assertSubtotal(dto.subtotal);

    const code = await this.nextCode(dto.companyId);

    return this.services.save(
      this.services.create({
        companyId: dto.companyId,
        serviceTypeId: dto.serviceTypeId,
        code,
        name: dto.name.trim(),
        description: dto.description ?? null,
        subtotal: dto.subtotal,
        // billable: dto.billable ?? true, // descomenta cuando exista en entidad + DTO
        vatRateId: dto.vatRateId ?? null,
        createdBy: dto.createdBy,
      }),
    );
  }

  /** Genera SRV-00001, SRV-00002, ... por empresa. */
  private async nextCode(companyId: string): Promise<string> {
    const n = await this.services.count({ where: { companyId } });
    return `SRV-${String(n + 1).padStart(5, '0')}`;
  }

  async update(dto: UpdateServiceDto) {
    const s = await this.get(dto.companyId, dto.id);
    if (dto.serviceTypeId && dto.serviceTypeId !== s.serviceTypeId) {
      const type = await this.getType(dto.companyId, dto.serviceTypeId);
      if (!type.isActive) throw new BadRequestException('El tipo de servicio está inactivo');
      s.serviceTypeId = type.id;
    }
    if (dto.name !== undefined) s.name = dto.name.trim();
    if (dto.description !== undefined) s.description = dto.description;
    if (dto.subtotal !== undefined) {
      this.assertSubtotal(dto.subtotal);
      s.subtotal = dto.subtotal;
    }
    if (dto.vatRateId !== undefined) s.vatRateId = dto.vatRateId;
    s.updatedBy = dto.updatedBy;
    return this.services.save(s);
  }

  async setActive(dto: SetActiveDto) {
    const s = await this.get(dto.companyId, dto.id);
    s.isActive = dto.isActive;
    s.updatedBy = dto.updatedBy;
    return this.services.save(s);
  }

  async list(dto: ListServicesDto) {
    const qb = this.services
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.serviceType', 't')
      .where('s.company_id = :companyId', { companyId: dto.companyId });

    if (dto.serviceTypeId) qb.andWhere('s.service_type_id = :tid', { tid: dto.serviceTypeId });
    if (dto.onlyActive) qb.andWhere('s.is_active = true AND t.is_active = true');
    if (dto.q?.trim()) {
      qb.andWhere('(s.name LIKE :q OR s.code LIKE :q)', { q: `%${dto.q.trim()}%` });
    }
    return qb.orderBy('t.name', 'ASC').addOrderBy('s.name', 'ASC').getMany();
  }

  async get(companyId: string, id: string) {
    const s = await this.services.findOne({ where: { id, companyId }, relations: ['serviceType'] });
    if (!s) throw new NotFoundException('Servicio no encontrado');
    return s;
  }

  /** Para facturar: devuelve el servicio listo como línea (cantidad fija = 1). */
  async getForInvoice(companyId: string, id: string) {
    const s = await this.get(companyId, id);
    if (!s.isActive || !s.serviceType.isActive) {
      throw new BadRequestException('El servicio está inactivo');
    }
    return {
      serviceId: s.id,
      code: s.code,
      description: s.name,
      quantity: 1,
      unitPrice: s.subtotal,
      subtotal: s.subtotal,
      vatRateId: s.vatRateId,
    };
  }

  private async getType(companyId: string, id: string) {
    const t = await this.types.findOne({ where: { id, companyId } });
    if (!t) throw new NotFoundException('Tipo de servicio no encontrado');
    return t;
  }

  private assertSubtotal(v: string) {
    if (!(Number(v) >= 0)) throw new BadRequestException('Subtotal inválido');
  }
}