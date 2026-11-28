import { Injectable } from '@nestjs/common';
import { BillingServiceClient } from '../common/microservices/billing-service-client';
import { CreateInvoiceGatewayDto } from './dto/create-invoice-gateway.dto';
import { CorrectInvoiceGatewayDto } from './dto/correct-invoice-gateway.dto';
import { CreateCreditNoteGatewayDto } from './dto/create-credit-note-gateway.dto';

type UserCtx = { userId: string; companyId: string; branchId?: string };

@Injectable()
export class SriDocumentsService {
  constructor(private readonly billing: BillingServiceClient) {}

  createInvoice(dto: CreateInvoiceGatewayDto, user: UserCtx) {
    return this.billing.send('create_invoice', { dto, user });
  }

  listVatRates() {
    return this.billing.send('list_vat_rates', {});
  }

  listPaymentMethods() {
    return this.billing.send('list_payment_methods', {});
  }

  list(user: UserCtx) {
    return this.billing.send('list_invoices', { user });
  }

  findOne(id: string, user: UserCtx) {
    return this.billing.send('get_sri_invoice', { id, user });
  }

  correct(id: string, dto: CorrectInvoiceGatewayDto, user: UserCtx) {
    return this.billing.send('correct_sri_invoice', { id, dto, user });
  }

  previewXml(documentId: string, user: UserCtx) {
    return this.billing.send('preview_document_xml', { documentId, user });
  }

  signDocument(documentId: string, user: UserCtx) {
    return this.billing.send('sign_document', { documentId, user });
  }

  sendDocument(documentId: string, user: UserCtx) {
    return this.billing.send('send_document', { documentId, user });
  }

  createCreditNote(dto: CreateCreditNoteGatewayDto, user: UserCtx) {
    return this.billing.send('create_credit_note', { dto, user });
  }

  retryDocument(documentId: string, user: UserCtx) {
    return this.billing.send('retry_document', { documentId, user });
  }
}