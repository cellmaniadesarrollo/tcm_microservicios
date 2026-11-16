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
    return this.service.createInvoice(d.user.companyId, d.dto);
  }

  @MessagePattern({ cmd: 'list_invoices' })
  listInvoices(@Payload() d: any) {
    return this.service.list(d.user.companyId);
  }
}