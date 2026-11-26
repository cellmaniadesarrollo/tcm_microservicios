import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { SyncGateway } from '../../sync/sync.gateway';

@Controller()
export class BillingRabbitmqController {
  constructor(private readonly syncGateway: SyncGateway) {}

  @EventPattern('invoice.updated')
  async handleInvoiceUpdated(data: any) {
    this.forward('invoice.updated', data);
  }

  @EventPattern('receipt.updated')
  async handleReceiptUpdated(data: any) {
    this.forward('receipt.updated', data);
  }

  private forward(event: string, data: any) {
    const companyId = data?.company_id || data?.companyId;
    if (!companyId) {
      console.warn(`[Billing] ${event} recibido sin company_id`);
      return;
    }
    this.syncGateway.server.to(`company:${companyId}`).emit(event, data);
  }
}