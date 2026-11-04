import { BadRequestException, Controller, HttpException, InternalServerErrorException, Logger } from '@nestjs/common';
import { SriService } from './sri.service';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';

@Controller('sri')
export class SriController {
  private readonly logger = new Logger(SriController.name);

  constructor(private readonly sriService: SriService) { }

  @MessagePattern({ cmd: 'sri_preview_access_key' })
  async previewAccessKey(@Payload() data: any) {
    if (!data?.accessKey || !data?.user?.companyId) {
      throw new RpcException(new BadRequestException('Payload incompleto: falta accessKey o user.companyId'));
    }
    try {
      return await this.sriService.previewAccessKey(data.accessKey, data.user.companyId);
    } catch (error: any) {
      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) throw new RpcException(error);
      this.logger.error('Error en sri_preview_access_key', error?.stack ?? error);
      throw new RpcException(new InternalServerErrorException('Error interno en MS Inventario'));
    }
  }
}
