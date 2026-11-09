import { Controller, HttpException, Logger } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { LabelsService } from '../services/labels.service';


@Controller()
export class LabelsController {
  private readonly logger = new Logger(LabelsController.name);

  constructor(private readonly labels: LabelsService) { }

  @MessagePattern({ cmd: 'print_labels' })
  async print(@Payload() data: any) {
    try {
      const companyId = data?.user?.companyId;
      if (!companyId) throw new RpcException(new BadRequestException('Usuario sin empresa'));
      return await this.labels.print(data.dto, companyId);
    } catch (error: any) {
      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) throw new RpcException(error);
      this.logger.error(`print_labels: ${error?.message}`, error?.stack);
      throw new RpcException(new InternalServerErrorException('No se pudo procesar la impresión'));
    }
  }
}