// microservices/orders/src/purchase-lead/purchase-lead.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { AwsS3Service } from '../aws-s3/aws-s3.service';
import { PurchaseLead } from './entities/purchase-leal.entity';
import { PurchaseLeadPhoto } from './entities/purchase-lead-photo.entity';
import { CreatePurchaseLeadDto } from './dto/create-purchase-leal.dto';
import { ListPurchaseLeadsDto } from './dto/list-purchase-leads.dto';
import { MarkContactedDto } from './dto/mark-contacted.dto';

type PhotoFile = { buffer: string; originalname: string; mimetype: string; size: number };

@Injectable()
export class PurchaseLeadService {
  private readonly MAX_PHOTOS = 5;

  constructor(
    @InjectRepository(PurchaseLead)
    private readonly repo: Repository<PurchaseLead>,
    @InjectRepository(PurchaseLeadPhoto)
    private readonly photoRepo: Repository<PurchaseLeadPhoto>,
    private readonly awsS3Service: AwsS3Service,
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

  // Detalle con fotos firmadas
  async findOne(id: number, companyId: string) {
    const lead = await this.findLeadOrFail(id, companyId);
    return { ...lead, photos: await this.signPhotos(lead.id) };
  }

  async markContacted(id: number, dto: MarkContactedDto, companyId: string) {
    const lead = await this.findLeadOrFail(id, companyId);
    lead.is_contacted = true;
    lead.contacted_at = new Date();
    if ((dto as any).notes) {
      lead.notes = [lead.notes, (dto as any).notes].filter(Boolean).join('\n');
    }
    return this.repo.save(lead);
  }

  async markClosed(id: number, companyId: string) {
    const lead = await this.findLeadOrFail(id, companyId);
    lead.is_closed = true;
    lead.closed_at = new Date();
    return this.repo.save(lead);
  }

  async remove(id: number, companyId: string) {
    const lead = await this.findLeadOrFail(id, companyId);
    await this.photoRepo.delete({ lead_id: lead.id }); // solo filas; los archivos quedan en S3
    await this.repo.remove(lead);
    return { deleted: true, id };
  }

  // ─── Fotos ───────────────────────────────────────────────

  private async findLeadOrFail(id: number, companyId: string) {
    const lead = await this.repo.findOne({ where: { id, company_id: companyId } });
    if (!lead) {
      throw new RpcException({ statusCode: 404, message: 'Lead no encontrado' });
    }
    return lead;
  }

  private async signPhotos(leadId: number) {
    const photos = await this.photoRepo.find({ where: { lead_id: leadId }, order: { id: 'ASC' } });
    return Promise.all(
      photos.map(async (p) => ({
        id: p.id,
        fileName: p.file_name,
        fileType: p.file_type,
        url: await this.awsS3Service.getPresignedUrl(p.file_key),
        createdAt: p.createdAt,
      })),
    );
  }

  async uploadPhotos(
    dto: { id: number; files: PhotoFile[] },
    user: { userId: string; companyId: string; branchId: string },
  ) {
    const lead = await this.findLeadOrFail(dto.id, user.companyId);

    const existing = await this.photoRepo.count({ where: { lead_id: lead.id } });
    if (existing + dto.files.length > this.MAX_PHOTOS) {
      throw new RpcException(
        new BadRequestException(`Máximo ${this.MAX_PHOTOS} fotos por interés (ya hay ${existing})`),
      );
    }

    const prefix = `purchase-leads/${user.companyId}/${lead.id}/`;

    for (const f of dto.files) {
      const key = await this.awsS3Service.uploadBuffer(
        Buffer.from(f.buffer, 'base64'), f.originalname, f.mimetype, prefix,
      );
      await this.photoRepo.save(
        this.photoRepo.create({
          lead_id: lead.id,
          file_key: key,
          file_name: f.originalname,
          file_type: f.mimetype,
          uploaded_by_id: user.userId,
        }),
      );
    }

    return {
      message: `${dto.files.length} foto(s) subida(s)`,
      photos: await this.signPhotos(lead.id),
    };
  }
}