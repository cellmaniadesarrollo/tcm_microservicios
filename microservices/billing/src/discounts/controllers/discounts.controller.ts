import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateDiscountInput,
  DiscountsService,
  SearchDiscountsFilter,
} from '../services/discounts.service';
import { DiscountDocType } from '../entities/document-discount.entity';

@Controller()
export class DiscountsController {
  constructor(private readonly service: DiscountsService) {}

  // ── Catálogo ──

  @MessagePattern('discounts.listAvailable')
  listAvailable(@Payload() d: { companyId: string }) {
    return this.service.listAvailable(d.companyId);
  }

  @MessagePattern('discounts.create')
  create(@Payload() d: { companyId: string; userId: string; dto: CreateDiscountInput }) {
    return this.service.create(d.companyId, d.userId, d.dto);
  }

  @MessagePattern('discounts.deactivateDiscount')
  deactivateDiscount(@Payload() d: { companyId: string; id: string; userId: string }) {
    return this.service.deactivateDiscount(d.companyId, d.id, d.userId);
  }

  // ── Aplicados a documentos ──

  @MessagePattern('discounts.listByDocument')
  listByDocument(
    @Payload() d: { companyId: string; documentType: DiscountDocType; documentId: string },
  ) {
    return this.service.listByDocument(d.companyId, d.documentType, d.documentId);
  }

  @MessagePattern('discounts.search')
  search(@Payload() d: SearchDiscountsFilter) {
    return this.service.search(d);
  }

  @MessagePattern('discounts.deactivateApplied')
  deactivateApplied(
    @Payload() d: { companyId: string; id: string; userId: string; reason?: string | null },
  ) {
    return this.service.deactivateApplied(d.companyId, d.id, d.userId, d.reason);
  }
}