import { BadRequestException, Controller, HttpException, InternalServerErrorException, Logger } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) { }
  private readonly logger = new Logger(SuppliersController.name);

  @MessagePattern({ cmd: 'get_supplier_form_options' })
  async getFormOptions(@Payload() data: any) {
    if (!data?.user?.companyId || !data?.user?.userId) {
      throw new RpcException(
        new BadRequestException('Payload incompleto: falta user.companyId o user.userId'),
      );
    }

    try {
      return await this.suppliersService.getFormOptions();
    } catch (error: any) {
      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) throw new RpcException(error);

      this.logger.error('Error en get_supplier_form_options', error?.stack ?? error);
      throw new RpcException(
        new InternalServerErrorException('Error interno en MS Inventario'),
      );
    }
  }
  @MessagePattern({ cmd: 'create_supplier' })
  async createSupplier(@Payload() data: any) {
    if (!data?.dto || !data?.user?.companyId || !data?.user?.userId) {
      throw new RpcException(
        new BadRequestException('Payload incompleto: falta dto, user.companyId o user.userId'),
      );
    }

    try {
      return await this.suppliersService.create(data.dto, data.user.companyId);
    } catch (error: any) {
      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) throw new RpcException(error);

      this.logger.error('Error en create_supplier', error?.stack ?? error);
      throw new RpcException(
        new InternalServerErrorException('Error interno en MS Inventario'),
      );
    }
  }

  @MessagePattern({ cmd: 'list_suppliers' })
  async list(@Payload() data: any) {
    if (!data?.user?.companyId || !data?.user?.userId) {
      throw new RpcException(
        new BadRequestException('Payload incompleto: falta user.companyId o user.userId'),
      );
    }
    try {
      return await this.suppliersService.findAll(data.query ?? {}, data.user.companyId);
    } catch (error: any) {
      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) throw new RpcException(error);
      this.logger.error('Error en list_suppliers', error?.stack ?? error);
      throw new RpcException(new InternalServerErrorException('Error interno en MS Inventario'));
    }
  }

  @MessagePattern({ cmd: 'get_supplier_full_data' })
  async getFullData(@Payload() data: any) {
    if (!data?.id || !data?.user?.companyId || !data?.user?.userId) {
      throw new RpcException(
        new BadRequestException('Payload incompleto: falta id, user.companyId o user.userId'),
      );
    }
    try {
      return await this.suppliersService.findOneFull(data.id, data.user.companyId);
    } catch (error: any) {
      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) throw new RpcException(error);
      this.logger.error('Error en get_supplier_full_data', error?.stack ?? error);
      throw new RpcException(new InternalServerErrorException('Error interno en MS Inventario'));
    }
  }
  @MessagePattern({ cmd: 'update_supplier' })
  async update(@Payload() data: any) {
    if (!data?.id || !data?.dto || !data?.user?.companyId || !data?.user?.userId) {
      throw new RpcException(
        new BadRequestException('Payload incompleto: falta id, dto, user.companyId o user.userId'),
      );
    }
    try {
      return await this.suppliersService.update(data.id, data.dto, data.user.companyId);
    } catch (error: any) {
      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) throw new RpcException(error);
      this.logger.error('Error en update_supplier', error?.stack ?? error);
      throw new RpcException(new InternalServerErrorException('Error interno en MS Inventario'));
    }
  }

  @MessagePattern({ cmd: 'update_supplier_status' })
  async updateStatus(@Payload() data: any) {
    if (!data?.id || typeof data?.status !== 'boolean' || !data?.user?.companyId || !data?.user?.userId) {
      throw new RpcException(
        new BadRequestException('Payload incompleto: falta id, status, user.companyId o user.userId'),
      );
    }
    try {
      return await this.suppliersService.updateStatus(data.id, data.status, data.user.companyId);
    } catch (error: any) {
      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) throw new RpcException(error);
      this.logger.error('Error en update_supplier_status', error?.stack ?? error);
      throw new RpcException(new InternalServerErrorException('Error interno en MS Inventario'));
    }
  }
  @MessagePattern({ cmd: 'search_suppliers' })
  async search(@Payload() data: any) {
    if (!data?.user?.companyId || !data?.user?.userId) {
      throw new RpcException(
        new BadRequestException('Payload incompleto: falta user.companyId o user.userId'),
      );
    }
    try {
      return await this.suppliersService.searchOptions(data.query ?? {}, data.user.companyId);
    } catch (error: any) {
      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) throw new RpcException(error);
      this.logger.error('Error en search_suppliers', error?.stack ?? error);
      throw new RpcException(new InternalServerErrorException('Error interno en MS Inventario'));
    }
  }
}
