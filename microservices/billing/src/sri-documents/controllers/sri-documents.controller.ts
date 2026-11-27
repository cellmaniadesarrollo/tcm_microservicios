import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InternalAuthInterceptor } from '../../interceptors/internal-auth.interceptor';
import { SriDocumentsService } from '../services/sri-documents.service';

@Controller()
@UseInterceptors(InternalAuthInterceptor)
export class SriDocumentsController {
  constructor(private readonly service: SriDocumentsService) {}

  @MessagePattern({ cmd: 'create_invoice' })
  createInvoice(@Payload() d: any) {
    return this.service.createInvoice(d.user.companyId, d.user.userId, d.dto);
  }

  @MessagePattern({ cmd: 'list_invoices' })
  listInvoices(@Payload() d: any) {
    return this.service.list(d.user.companyId);
  }

  @MessagePattern({ cmd: 'list_vat_rates' })
  listVatRates() {
    return this.service.listVatRates();
  }

  @MessagePattern({ cmd: 'list_payment_methods' })
  listPaymentMethods() {
    return this.service.listPaymentMethods();
  }

  @MessagePattern({ cmd: 'get_sri_invoice' })
  getInvoice(@Payload() d: any) {
    return this.service.findOne(d.user.companyId, d.id);
  }

  @MessagePattern({ cmd: 'correct_sri_invoice' })
  correctInvoice(@Payload() d: any) {
    return this.service.correct(d.user.companyId, d.id, d.dto);
  }
}