// receipts.controller.ts
import { BadRequestException, Controller, HttpException, InternalServerErrorException, Logger } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { ReceiptsService } from './receipts.service';

@Controller('receipts')
export class ReceiptsController {
  private readonly logger = new Logger(ReceiptsController.name);

  constructor(private readonly receiptsService: ReceiptsService) { }

  @MessagePattern({ cmd: 'get_receipt_new_data' })
  async getNewData(@Payload() data: any) {
    if (!data?.user?.companyId) {
      throw new RpcException(
        new BadRequestException('Payload incompleto: falta user.companyId'),
      );
    }

    try {
      return await this.receiptsService.getNewData(data.user.companyId);
    } catch (error: any) {
      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) throw new RpcException(error);

      this.logger.error('Error en get_receipt_new_data', error?.stack ?? error);
      throw new RpcException(
        new InternalServerErrorException('Error interno en MS Inventario'),
      );
    }
  }
  @MessagePattern({ cmd: 'create_receipt' })
  async createReceipt(@Payload() data: any) {
    if (!data?.dto || !data?.user?.companyId || !data?.user?.userId) {
      throw new RpcException(
        new BadRequestException('Payload incompleto: falta dto, user.companyId o user.userId'),
      );
    }

    try {
      return await this.receiptsService.create(data.dto, data.user.companyId, data.user.userId, data.files ?? {},);
    } catch (error: any) {
      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) throw new RpcException(error);

      this.logger.error('Error en create_receipt', error?.stack ?? error);
      throw new RpcException(new InternalServerErrorException('Error interno en MS Inventario'));
    }
  }
  @MessagePattern({ cmd: 'list_receipts' })
  async listReceipts(@Payload() data: any) {
    if (!data?.user?.companyId) {
      throw new RpcException(new BadRequestException('Payload incompleto: falta user.companyId'));
    }
    try {
      return await this.receiptsService.list(data.query ?? {}, data.user.companyId);
    } catch (error: any) {
      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) throw new RpcException(error);
      this.logger.error('Error en list_receipts', error?.stack ?? error);
      throw new RpcException(new InternalServerErrorException('Error interno en MS Inventario'));
    }
  }
  @MessagePattern({ cmd: 'add_receipt_payment' })
  async addPayment(@Payload() data: any) {
    if (!data?.receiptId || !data?.dto || !data?.user?.companyId || !data?.user?.userId) {
      throw new RpcException(new BadRequestException('Payload incompleto'));
    }
    return this.run('add_receipt_payment', () =>
      this.receiptsService.addPayment(data.receiptId, data.dto, data.user.companyId, data.user.userId, data.file));
  }

  @MessagePattern({ cmd: 'void_receipt_payment' })
  async voidPayment(@Payload() data: any) {
    if (!data?.receiptId || !data?.paymentId || !data?.user?.companyId || !data?.user?.userId) {
      throw new RpcException(new BadRequestException('Payload incompleto'));
    }
    return this.run('void_receipt_payment', () =>
      this.receiptsService.voidPayment(data.receiptId, data.paymentId, data.dto?.reason, data.user.companyId, data.user.userId));
  }

  @MessagePattern({ cmd: 'list_receipt_payments' })
  async listPayments(@Payload() data: any) {
    if (!data?.receiptId || !data?.user?.companyId) {
      throw new RpcException(new BadRequestException('Payload incompleto'));
    }
    return this.run('list_receipt_payments', () =>
      this.receiptsService.listPayments(data.receiptId, data.user.companyId));
  }


  private async run<T>(name: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) throw new RpcException(error);
      this.logger.error(`Error en ${name}`, error?.stack ?? error);
      throw new RpcException(new InternalServerErrorException('Error interno en MS Inventario'));
    }
  }
  @MessagePattern({ cmd: 'get_receipt_detail' })
  async getDetail(@Payload() data: any) {
    if (!data?.receiptId || !data?.user?.companyId) {
      throw new RpcException(new BadRequestException('Payload incompleto'));
    }
    return this.run('get_receipt_detail', () =>
      this.receiptsService.getDetail(data.receiptId, data.user.companyId));
  }
}