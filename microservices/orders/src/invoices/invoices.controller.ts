import { Controller } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) { }

  @MessagePattern({ cmd: 'list_invoices' })
  async listInvoices(@Payload() data: any) {
    console.log('da')
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      const result = await this.invoicesService.listInvoices(data.dto, data.user);

      console.log('✅ MS Órdenes - Listado de facturas obtenido');
      return result;
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (listInvoices):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  @MessagePattern({ cmd: 'resend_invoice' })
  async resendInvoice(@Payload() data: any) {
    try {
      if (!data.invoiceId || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta invoiceId o user');
      }

      const result = await this.invoicesService.resendInvoice(data.invoiceId, data.user);

      console.log('✅ MS Órdenes - Factura reenviada:', data.invoiceId);
      return result;
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (resendInvoice):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  // 👇 NUEVO
  @MessagePattern({ cmd: 'get_sold_status' })
  async getSoldStatus(@Payload() data: any) {
    try {
      if (!data.orderPublicIds || !Array.isArray(data.orderPublicIds)) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta orderPublicIds (array)');
      }

      const result = await this.invoicesService.getSoldStatusByPublicIds(data.orderPublicIds);

      console.log(`✅ MS Órdenes - Estado de venta consultado para ${data.orderPublicIds.length} órdenes`);
      return result;
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (getSoldStatus):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }
}