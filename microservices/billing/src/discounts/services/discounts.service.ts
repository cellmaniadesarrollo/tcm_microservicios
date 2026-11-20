import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  DiscountDocType,
  DiscountType,
  DocumentDiscount,
} from '../entities/document-discount.entity';
import { Discount, DiscountValueKind } from '../entities/discount.entity';

export interface DiscountInput {
  lineId: string | null;
  discountId: string | null; // del catálogo
  type: DiscountType;
  amount: string; // dinero ya calculado por el servidor
  base: string; // cantidad × precio
  reason: string | null;
}

export interface CreateDiscountInput {
  name: string;
  type: DiscountType;
  valueKind: DiscountValueKind;
  value: number;
}

export interface SearchDiscountsFilter {
  companyId: string;
  branchId?: string;
  documentType?: DiscountDocType;
  type?: DiscountType;
  createdBy?: string;
  from?: string; // ISO
  to?: string; // ISO
  limit?: number;
  offset?: number;
  includeInactive?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DiscountsService {
  constructor(
    @InjectRepository(DocumentDiscount)
    private readonly repo: Repository<DocumentDiscount>,
    @InjectRepository(Discount)
    private readonly catalog: Repository<Discount>,
  ) {}

  // ───────────────────────── Catálogo ─────────────────────────

  /** Usable = activo y (es default o aún no vence). Fuente de verdad del vencimiento. */
  private usable(alias = 'x') {
    return `${alias}.is_active = true AND (${alias}.is_default = true OR ${alias}.expires_at > now())`;
  }

  /** Lo que ve el cajero al vender. */
  listAvailable(companyId: string) {
    return this.catalog
      .createQueryBuilder('x')
      .where('x.company_id = :companyId', { companyId })
      .andWhere(this.usable())
      .orderBy('x.is_default', 'DESC')
      .addOrderBy('x.name', 'ASC')
      .getMany();
  }

  /** Crea un descuento temporal: vence 24 h después de crearse. */
  create(companyId: string, userId: string, dto: CreateDiscountInput) {
    if (dto.valueKind === 'PERCENT' && dto.value > 100) {
      throw new RpcException({ statusCode: 400, message: 'El porcentaje no puede superar 100.' });
    }

    return this.catalog.save(
      this.catalog.create({
        companyId,
        name: dto.name.trim(),
        type: dto.type,
        valueKind: dto.valueKind,
        value: dto.value.toFixed(2),
        isDefault: false,
        isActive: true,
        expiresAt: new Date(Date.now() + DAY_MS),
        createdBy: userId,
      }),
    );
  }

  /** Desactiva a mano un descuento del catálogo (los default no se pueden). */
  async deactivateDiscount(companyId: string, id: string, userId: string) {
    const res = await this.catalog.update(
      { id, companyId, isDefault: false, isActive: true },
      { isActive: false, deactivatedBy: userId, deactivatedAt: new Date() },
    );
    return { updated: res.affected ?? 0 };
  }

  /**
   * Valida el descuento al vender y calcula el monto en el servidor.
   * gross y el resultado `cents` van en centavos.
   */
  async resolveForLine(m: EntityManager, companyId: string, discountId: string, gross: number) {
    const d = await m
      .getRepository(Discount)
      .createQueryBuilder('x')
      .where('x.id = :discountId AND x.company_id = :companyId', { discountId, companyId })
      .andWhere(this.usable())
      .getOne();

    if (!d) {
      throw new RpcException({ statusCode: 400, message: 'Descuento no disponible o vencido.' });
    }

    const raw =
      d.valueKind === 'PERCENT'
        ? Math.round((gross * Number(d.value)) / 100)
        : Math.round(Number(d.value) * 100);

    return { discount: d, cents: Math.min(raw, gross) };
  }

  // ─────────────────── Descuentos aplicados a documentos ───────────────────

  /** Llamar dentro de la transacción del documento (usa el EntityManager de esa transacción). */
  async record(
    m: EntityManager,
    ctx: { companyId: string; branchId: string; userId: string },
    documentType: DiscountDocType,
    documentId: string,
    items: DiscountInput[],
  ) {
    if (!items.length) return;
    await m.save(
      DocumentDiscount,
      items.map((d) => ({
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        documentType,
        documentId,
        lineId: d.lineId,
        discountId: d.discountId,
        type: d.type,
        amount: d.amount,
        baseAmount: d.base,
        reason: d.reason,
        createdBy: ctx.userId,
      })),
    );
  }

  /** Descuentos de un documento puntual. */
  listByDocument(companyId: string, documentType: DiscountDocType, documentId: string) {
    return this.repo.find({
      where: { companyId, documentType, documentId },
      order: { createdAt: 'ASC' },
    });
  }

  /** Búsqueda para reportes: por usuario, tipo, documento, sucursal y rango de fechas. */
  async search(f: SearchDiscountsFilter) {
    const qb = this.repo
      .createQueryBuilder('d')
      .where('d.company_id = :companyId', { companyId: f.companyId });

    if (f.branchId) qb.andWhere('d.branch_id = :branchId', { branchId: f.branchId });
    if (f.documentType) qb.andWhere('d.document_type = :dt', { dt: f.documentType });
    if (f.type) qb.andWhere('d.type = :type', { type: f.type });
    if (f.createdBy) qb.andWhere('d.created_by = :cb', { cb: f.createdBy });
    if (f.from) qb.andWhere('d.created_at >= :from', { from: f.from });
    if (f.to) qb.andWhere('d.created_at <= :to', { to: f.to });
    if (!f.includeInactive) qb.andWhere('d.is_active = true');

    const limit = Math.min(f.limit ?? 50, 200);
    const [items, total] = await qb
      .orderBy('d.created_at', 'DESC')
      .take(limit)
      .skip(f.offset ?? 0)
      .getManyAndCount();

    return { items, total };
  }

  /** Desactiva un descuento ya aplicado a un documento. */
  async deactivateApplied(companyId: string, id: string, userId: string, reason?: string | null) {
    const res = await this.repo.update(
      { id, companyId, isActive: true },
      {
        isActive: false,
        deactivatedBy: userId,
        deactivatedAt: new Date(),
        deactivationReason: reason?.trim() || null,
      },
    );
    return { updated: res.affected ?? 0 };
  }

  /** Desactiva todos los descuentos de un documento (al anular recibo/factura, dentro de su transacción). */
  async deactivateByDocument(
    m: EntityManager,
    ctx: { companyId: string; userId: string },
    documentType: DiscountDocType,
    documentId: string,
    reason?: string | null,
  ) {
    await m.update(
      DocumentDiscount,
      { companyId: ctx.companyId, documentType, documentId, isActive: true },
      {
        isActive: false,
        deactivatedBy: ctx.userId,
        deactivatedAt: new Date(),
        deactivationReason: reason?.trim() || null,
      },
    );
  }
}