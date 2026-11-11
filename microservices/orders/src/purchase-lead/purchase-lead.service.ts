// microservices/orders/src/purchase-lead/purchase-lead.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
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

  async create(
    dto: CreatePurchaseLeadDto,
    user: { userId: string; companyId: string; branchId: string },
  ) {
    const lead = this.repo.create({
      ...dto,
      company_id: user.companyId,
      branch_id: user.branchId,
      created_by_id: user.userId,
    });
    return this.repo.save(lead);
  }

  async findAll(filters: ListPurchaseLeadsDto, companyId: string) {
    const page = Number((filters as any).page ?? 1);
    const limit = Number((filters as any).limit ?? 20);

    const qb = this.repo
      .createQueryBuilder('l')
      .where('l.company_id = :companyId', { companyId })
      .orderBy('l.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const f: any = filters;
    if (f.is_contacted !== undefined)
      qb.andWhere('l.is_contacted = :c', { c: f.is_contacted });
    if (f.is_closed !== undefined)
      qb.andWhere('l.is_closed = :cl', { cl: f.is_closed });
    if (f.search) {
      qb.andWhere(
        `(l.customer_first_name ILIKE :s OR l.customer_last_name ILIKE :s
          OR l.customer_id_number ILIKE :s OR l.model_name ILIKE :s)`,
        { s: `%${f.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: number, companyId: string) {
    const lead = await this.repo.findOne({ where: { id, company_id: companyId } });
    if (!lead) {
      throw new RpcException({ statusCode: 404, message: 'Lead no encontrado' });
    }
    return lead;
  }

  async markContacted(id: number, dto: MarkContactedDto, companyId: string) {
    const lead = await this.findOne(id, companyId);
    lead.is_contacted = true;
    lead.contacted_at = new Date();
    if ((dto as any).notes) {
      lead.notes = [lead.notes, (dto as any).notes].filter(Boolean).join('\n');
    }
    return this.repo.save(lead);
  }

  async markClosed(id: number, companyId: string) {
    const lead = await this.findOne(id, companyId);
    lead.is_closed = true;
    lead.closed_at = new Date();
    return this.repo.save(lead);
  }

  async remove(id: number, companyId: string) {
    const lead = await this.findOne(id, companyId);
    await this.repo.remove(lead);
    return { deleted: true, id };
  }
}