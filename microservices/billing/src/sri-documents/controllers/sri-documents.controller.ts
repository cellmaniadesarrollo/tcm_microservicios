import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InternalAuthInterceptor } from '../../interceptors/internal-auth.interceptor';
import { CreditNotesService } from '../services/credit-notes.service';
import { SriDocumentsService } from '../services/sri-documents.service';
import { SriEmissionService } from '../services/sri-emission.service';

@Controller()
@UseInterceptors(InternalAuthInterceptor)
export class SriDocumentsController {
  constructor(
    private readonly service: SriDocumentsService,
    private readonly creditNotes: CreditNotesService,
    private readonly emission: SriEmissionService,
  ) {}

  @MessagePattern({ cmd: 'create_invoice' })
  createInvoice(@Payload() d: any) {
    return this.service.createInvoice(d.user.companyId, d.user.userId, d.dto);
  }

  @MessagePattern({ cmd: 'create_credit_note' })
  createCreditNote(@Payload() d: any) {
    return this.creditNotes.create(d.user.companyId, d.user.userId, d.dto);
  }

  @MessagePattern({ cmd: 'list_invoices' })
  listInvoices(@Payload() d: any) {
    return this.service.list(d.user.companyId, d.documentTypeCode);
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

  @MessagePattern({ cmd: 'retry_document' })
  retryDocument(@Payload() d: any) {
    return this.emission.retry(d.user.companyId, d.documentId);
  }
}