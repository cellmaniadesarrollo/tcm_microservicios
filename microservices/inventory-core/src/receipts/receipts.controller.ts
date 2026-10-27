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
      return await this.receiptsService.create(data.dto, data.user.companyId, data.user.userId);
    } catch (error: any) {
      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) throw new RpcException(error);

      this.logger.error('Error en create_receipt', error?.stack ?? error);
      throw new RpcException(new InternalServerErrorException('Error interno en MS Inventario'));
    }
  }
}