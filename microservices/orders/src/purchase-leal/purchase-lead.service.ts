import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import { PurchaseLead } from './entities/purchase-leal.entity';
import { CreatePurchaseLeadDto } from './dto/create-purchase-leal.dto';
import { ListPurchaseLeadsDto } from './dto/list-purchase-leads.dto';
import { MarkContactedDto } from './dto/mark-contacted.dto';

@Injectable()
export class PurchaseLeadService {
  constructor(
    @InjectRepository(PurchaseLead)
    private readonly repo: Repository<PurchaseLead>,
  ) {}

  // ─── Crear ────────────────────────────────────────────────────────────────

  async create(
    dto: CreatePurchaseLeadDto,
    createdById: string,
  ): Promise<PurchaseLead> {
    const lead = this.repo.create({
      ...dto,
      created_by_id: createdById,
      is_contacted: false,
      is_closed: false,
    });

    return this.repo.save(lead);
  }

  // ─── Listar ───────────────────────────────────────────────────────────────

  async findAll(filters: ListPurchaseLeadsDto): Promise<{
    data: PurchaseLead[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      company_id,
      branch_id,
      search,
      is_contacted,
      is_closed,
      brand_id,
      model_id,
      page = 1,
      limit = 20,
    } = filters;

    const qb = this.repo
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.company', 'company')
      .leftJoinAndSelect('lead.branch', 'branch')
      .leftJoinAndSelect('lead.createdBy', 'createdBy')
      .orderBy('lead.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (company_id) qb.andWhere('lead.company_id = :company_id', { company_id });
    if (branch_id)  qb.andWhere('lead.branch_id = :branch_id', { branch_id });
    if (brand_id)   qb.andWhere('lead.brand_id = :brand_id', { brand_id });
    if (model_id)   qb.andWhere('lead.model_id = :model_id', { model_id });

    if (typeof is_contacted === 'boolean')
      qb.andWhere('lead.is_contacted = :is_contacted', { is_contacted });

    if (typeof is_closed === 'boolean')
      qb.andWhere('lead.is_closed = :is_closed', { is_closed });

    if (search) {
      qb.andWhere(
        `(
          lead.customer_first_name ILIKE :s OR
          lead.customer_last_name  ILIKE :s OR
          lead.customer_id_number  ILIKE :s OR
          lead.device_imei         ILIKE :s OR
          lead.model_name          ILIKE :s OR
          lead.brand_name          ILIKE :s
        )`,
        { s: `%${search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  // ─── Obtener uno ──────────────────────────────────────────────────────────

  async findOne(id: number): Promise<PurchaseLead> {
    const lead = await this.repo.findOne({ where: { id } });
    if (!lead) throw new NotFoundException(`Purchase lead #${id} no encontrado`);
    return lead;
  }

  // ─── Marcar como contactado ───────────────────────────────────────────────

  async markContacted(id: number, dto: MarkContactedDto): Promise<PurchaseLead> {
    const lead = await this.findOne(id);

    lead.is_contacted = true;
    lead.contacted_at = new Date();
    if (dto.notes) lead.notes = dto.notes;

    return this.repo.save(lead);
  }

  // ─── Marcar como cerrado (compra concretada) ──────────────────────────────

  async markClosed(id: number): Promise<PurchaseLead> {
    const lead = await this.findOne(id);

    lead.is_closed = true;
    lead.closed_at = new Date();

    return this.repo.save(lead);
  }

  // ─── Eliminar ─────────────────────────────────────────────────────────────

  async remove(id: number): Promise<void> {
    const lead = await this.findOne(id);
    await this.repo.remove(lead);
  }
}