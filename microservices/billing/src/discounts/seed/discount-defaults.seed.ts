import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discount } from '../entities/discount.entity';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';

/** Usuario "sistema" para createdBy de los descuentos por defecto. */
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

const DEFAULTS = [
  { name: 'Descuento $0.50', value: '0.50' },
  { name: 'Descuento $0.75', value: '0.75' },
  { name: 'Descuento $1.00', value: '1.00' },
  { name: 'Descuento $1.50', value: '1.50' },
  { name: 'Descuento $2.00', value: '2.00' },
] as const;

@Injectable()
export class DiscountDefaultsSeed implements OnModuleInit {
  private readonly logger = new Logger(DiscountDefaultsSeed.name);

  constructor(
    @InjectRepository(Discount) private readonly catalog: Repository<Discount>,
    @InjectRepository(CompanyReplica) private readonly companies: Repository<CompanyReplica>,
  ) {}

  /** Al arrancar: asegura los 5 descuentos para todas las empresas existentes. */
  async onModuleInit() {
    const companies = await this.companies.find({ select: { id: true } });
    for (const c of companies) await this.ensureDefaults(c.id);
    this.logger.log(`Descuentos por defecto verificados en ${companies.length} empresa(s).`);
  }

  /** Idempotente: si ya existen, no hace nada (el índice único lo garantiza). */
  async ensureDefaults(companyId: string) {
    await this.catalog
      .createQueryBuilder()
      .insert()
      .into(Discount)
      .values(
        DEFAULTS.map((d) => ({
          companyId,
          name: d.name,
          type: 'NORMAL' as const,
          valueKind: 'AMOUNT' as const,
          value: d.value,
          isDefault: true,
          isActive: true,
          expiresAt: null,
          createdBy: SYSTEM_USER_ID,
        })),
      )
      .orIgnore()
      .execute();
  }
}