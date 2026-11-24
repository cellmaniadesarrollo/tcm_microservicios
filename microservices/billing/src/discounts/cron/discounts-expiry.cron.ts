import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discount } from '../entities/discount.entity';

@Injectable()
export class DiscountsExpiryCron {
  private readonly logger = new Logger(DiscountsExpiryCron.name);

  constructor(@InjectRepository(Discount) private readonly catalog: Repository<Discount>) {}

  /** Desactiva los descuentos temporales vencidos. Los default nunca se tocan. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async deactivateExpired() {
    const res = await this.catalog
      .createQueryBuilder()
      .update(Discount)
      .set({ isActive: false, deactivatedAt: () => 'now()' })
      .where('is_default = false AND is_active = true AND expires_at <= now()')
      .execute();

    if (res.affected) this.logger.log(`Descuentos vencidos desactivados: ${res.affected}`);
  }
}