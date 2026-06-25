import { Controller } from '@nestjs/common';
import { OrderWorkflowService } from './order-workflow.service';
import { Ctx, MessagePattern, Payload, RmqContext, RpcException } from '@nestjs/microservices';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { GetOrderFullDataDto } from './dto/get-order-full-data.dto';
import { ChangeOrderStatusDto } from './dto/change-order-status.dto';
import { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import { CloseOrderDto } from '../order-findings/dto/close-order.dto';
import { OrderDelivery } from './entities/order-delivery.entity';
import { CreateOrderNoteDto } from './dto/create-order-note.dto';
import { UpdateOrderNoteDto } from './dto/update-order-note.dto';
import { GetOrderPaymentDto } from './dto/get-order-payment.dto';
import { LinkDeviceToOrderDto } from '../devices/dto/update-device.dto';
import { SaveInboundDto } from './dto/save-inbound.dto';
import { SaveOutboundDto } from './dto/save-outbound.dto';
import { OrderShippingService } from './order-shipping.service';
import { VerifyOrderPaymentDto } from './dto/verify-order-payment.dto';

@Controller('order-workflow')
export class OrderWorkflowController {
  constructor(private readonly orderWorkflowService: OrderWorkflowService,
    private readonly orderShippingService: OrderShippingService) { }

  @MessagePattern({ cmd: 'async_orders_start' })
  async onSyncStart(
    @Payload() payload: any,
    @Ctx() context: RmqContext,
  ) {
    console.log('🔄 Sync órdenes solicitada | fromCache:', payload.fromCache ?? 'inicio');

    const result = await this.orderWorkflowService.findFullDataForSync(payload.fromCache);
    console.log(`📤 Respuesta lista | cantidad: ${result?.length ?? 0}`);

    // ── Respuesta manual para clientes no-NestJS (Express/amqplib) ──
    const originalMsg = context.getMessage();
    const replyTo = originalMsg.properties.replyTo;

    if (replyTo === 'inventory_orders_sync_reply') {
      const ch = context.getChannelRef();
      ch.sendToQueue(
        'inventory_orders_sync_reply',
        Buffer.from(JSON.stringify(result)),
        { correlationId: originalMsg.properties.correlationId },
      );
    }

    return result; // ← NestJS ClientProxy sigue funcionando normal
  }


  @MessagePattern({ cmd: 'create_order' })
  async createOrder(data: {
    dto: CreateOrderDto;
    files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>;
    user: { userId: string; companyId: string; branchId: string };
  }) {
    return this.orderWorkflowService.createOrder(data.dto, data.files ?? [], data.user);
  }
  @MessagePattern({ cmd: 'list_orders' })
  async listOrders(data: {
    dto: ListOrdersDto;
    user: {
      userId: string;
      companyId: string;
      branchId: string;
    };
  }) {
    const orders = await this.orderWorkflowService.listOrders(
      data.user,
      data.dto,
    );
    return orders
  }
  @MessagePattern({ cmd: 'list_my_orders' })
  async listMyOrders(data: {
    dto: ListOrdersDto;
    user: {
      userId: string;
      companyId: string;
      branchId: string;
    };
  }) {
    return this.orderWorkflowService.listMyOrders(
      data.user,
      data.dto,
    );
  }
  @MessagePattern({ cmd: 'get_order_full_data' })
  async getOrderFullData(data: {
    dto: GetOrderFullDataDto;
    user: {
      userId: string;
      companyId: string;
      branchId: string;
    };
  }) {
    const datas = await this.orderWorkflowService.getOrderFullData(
      data.dto.orderId,
      data.user,
    );
    // console.log(datas.findings[0])
    return datas
  }

  @MessagePattern({ cmd: 'change_order_status' })
  async changeOrderStatus(@Payload() data: any) {
    try {


      // 2. Validación manual rápida (por si el Pipe falla silenciosamente)
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      // 3. Ejecución de la lógica
      const result = await this.orderWorkflowService.changeOrderStatus(
        data.dto,
        data.user,
      );

      console.log('✅ MS Órdenes - Resultado exitoso');
      return result;

    } catch (error: any) {
      // AQUÍ es donde atraparemos al culpable
      console.error('🔥 Error crítico en MS Órdenes:', error);

      // Si el error tiene un stack trace, imprímelo
      if (error.stack) {
        console.error(error.stack);
      }

      // Devolvemos una RpcException para que el Gateway reciba el mensaje real
      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null
      });
    }
  }


  @MessagePattern({ cmd: 'register_order_payment' })
  async registerPayment(
    @Payload() data: {
      dto: CreateOrderPaymentDto;
      files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>; // ← nuevo
      user: {
        userId: string;
        companyId: string;
        branchId: string;
      };
    },
  ): Promise<any> {
    return this.orderWorkflowService.registerIncomePayment(
      data.dto,
      data.user,
      data.files ?? [], // ← nuevo
    );
  }
  @MessagePattern({ cmd: 'close_order' })
  async closeOrder(
    @Payload() data: {
      dto: CloseOrderDto;
      files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>; // ← nuevo
      user: { userId: string; companyId: string; branchId: string };
    },
  ): Promise<OrderDelivery> {
    return this.orderWorkflowService.closeOrder(
      data.dto,
      data.user,
      data.files ?? [], // ← nuevo
    );
  }

  @MessagePattern({ cmd: 'get_payment_catalogs' })
  async getPaymentCatalogs() {
    const [types, methods] = await Promise.all([
      this.orderWorkflowService.getPaymentTypes(),
      this.orderWorkflowService.getPaymentMethods(),
    ]);

    return { paymentTypes: types, paymentMethods: methods };
  }
  @MessagePattern({ cmd: 'get_last_orders_by_device' })
  async getLastOrdersByDevice(data: {
    deviceId: number;
    user: { userId: string; companyId: string; branchId: string };
  }) {
    return this.orderWorkflowService.getLastOrdersByDevice(data.deviceId, data.user);
  }


  @MessagePattern({ cmd: 'get_order_public_data' })
  async getOrderPublicData(@Payload() data: { publicId: string }) {
    return this.orderWorkflowService.getOrderPublicData(data.publicId);
  }
  @MessagePattern({ cmd: 'create_order_note' })
  async createOrderNote(data: {
    dto: CreateOrderNoteDto;
    user: { userId: string; companyId: string; branchId: string };
  }) {
    console.log(data)
    return this.orderWorkflowService.createOrderNote(data.dto, data.user);
  }
  //para rebuild test
  @MessagePattern({ cmd: 'delete_order_note' })
  async deleteOrderNote(data: {
    dto: { note_id: number };
    user: { userId: string; companyId: string; branchId: string };
  }) {
    return this.orderWorkflowService.deleteOrderNote(data.dto.note_id, data.user);
  }
  @MessagePattern({ cmd: 'update_order_note' })
  async updateOrderNote(data: {
    noteId: number;
    dto: UpdateOrderNoteDto;
    user: { userId: string; companyId: string; branchId: string };
  }) {
    return this.orderWorkflowService.updateOrderNote(data.noteId, data.dto, data.user);
  }
  @MessagePattern({ cmd: 'get_order_payment' })
  async getOrderPayment(data: {
    dto: GetOrderPaymentDto;
    user: { userId: string; companyId: string; branchId: string };
  }) {
    return this.orderWorkflowService.getOrderPayment(data.dto, data.user);
  }
  @MessagePattern({ cmd: 'link_device_to_order' })
  async linkDeviceToOrder(data: {
    dto: LinkDeviceToOrderDto;
    user: { companyId: string };
  }) {
    return this.orderWorkflowService.linkDeviceToOrder(data.dto, data.user);
  }

  @MessagePattern({ cmd: 'save_order_inbound' })
  async saveInbound(@Payload() payload: { orderId: number; dto: SaveInboundDto }) {
    return this.orderShippingService.saveInbound(payload.orderId, payload.dto);
  }

  @MessagePattern({ cmd: 'save_order_outbound' })
  async saveOutbound(@Payload() payload: { orderId: number; dto: SaveOutboundDto }) {
    return this.orderShippingService.saveOutbound(payload.orderId, payload.dto);
  }

  @MessagePattern({ cmd: 'get_order_shipping' })
  async getShipping(@Payload() payload: { orderId: number }) {
    return this.orderShippingService.findByOrder(payload.orderId);
  }
  @MessagePattern({ cmd: 'verify_order_payment' })
  async verifyOrderPayment(@Payload() data: {
    dto: VerifyOrderPaymentDto;
    internalToken: string;
  }) {
    return this.orderWorkflowService.verifyOrderPayment(data.dto);
  }


  @MessagePattern({ cmd: 'get_payment_signed_urls' })
  async getPaymentSignedUrls(@Payload() data: {
    paymentId: number;
    companyId: string;
    internalToken: string;
  }) {
    return this.orderWorkflowService.getPaymentSignedUrls(data.paymentId, data.companyId);
  }
}

