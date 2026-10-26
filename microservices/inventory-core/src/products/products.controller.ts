import { BadRequestException, Controller, HttpException, InternalServerErrorException, Logger } from '@nestjs/common';
import { ProductsService } from './products.service';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }
  private readonly logger = new Logger(ProductsController.name);

  @MessagePattern({ cmd: 'create_product' })
  async createProduct(@Payload() data: any) {
    if (!data?.dto || !data?.user?.companyId || !data?.user?.userId) {
      throw new RpcException(
        new BadRequestException('Payload incompleto: falta dto, user.companyId o user.userId'),
      );
    }

    try {
      return await this.productsService.create(
        data.dto,
        data.user.companyId,
        data.user.userId,
        data.files ?? [],
      );
    } catch (error: any) {
      // Ya viene en el formato del gateway: se conserva el status original
      if (error instanceof RpcException) throw error;

      // Excepción HTTP lanzada sin envolver
      if (error instanceof HttpException) throw new RpcException(error);

      this.logger.error('Error en create_product', error?.stack ?? error);
      throw new RpcException(
        new InternalServerErrorException('Error interno en MS Inventario'),
      );
    }
  }

  @MessagePattern({ cmd: 'list_products' })
  async listProducts(@Payload() data: any) {
    if (!data?.user?.companyId) {
      throw new RpcException(
        new BadRequestException('Payload incompleto: falta user.companyId'),
      );
    }
    return this.productsService.list(data.query ?? {}, data.user.companyId);
  }

  @MessagePattern({ cmd: 'get_product_filters' })
  async getProductFilters(@Payload() data: any) {
    if (!data?.user?.companyId) {
      throw new RpcException(
        new BadRequestException('Payload incompleto: falta user.companyId'),
      );
    }
    return this.productsService.listFilters(data.user.companyId);
  }

  @MessagePattern({ cmd: 'update_product' })
  async updateProduct(@Payload() data: any) {
    this.assertPayload(data, ['id', 'dto']);
    return this.run(() =>
      this.productsService.update(data.id, data.dto, data.user.companyId, data.user.userId),
    );
  }

  @MessagePattern({ cmd: 'delete_product' })
  async deleteProduct(@Payload() data: any) {
    this.assertPayload(data, ['id']);
    return this.run(() =>
      this.productsService.remove(data.id, data.user.companyId, data.user.userId),
    );
  }

  private assertPayload(data: any, required: string[]) {
    const ok = required.every((k) => data?.[k]) && data?.user?.companyId && data?.user?.userId;
    if (!ok) {
      throw new RpcException(
        new BadRequestException(`Payload incompleto: falta ${required.join(', ')}, user.companyId o user.userId`),
      );
    }
  }

  /** Mismo manejo de errores que create_product, centralizado. */
  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) throw new RpcException(error);
      this.logger.error('Error en MS Inventario', error?.stack ?? error);
      throw new RpcException(new InternalServerErrorException('Error interno en MS Inventario'));
    }
  }
  @MessagePattern({ cmd: 'get_product' })
  async getProduct(@Payload() data: any) {
    this.assertPayload(data, ['id']);
    return this.run(() => this.productsService.findOne(data.id, data.user.companyId));
  }

  @MessagePattern({ cmd: 'get_product_history' })
  async getProductHistory(@Payload() data: any) {
    this.assertPayload(data, ['id']);
    return this.run(() =>
      this.productsService.history(data.id, data.user.companyId, data.page, data.limit),
    );
  }
  @MessagePattern({ cmd: 'search_products_for_receipt' })
  async searchProductsForReceipt(@Payload() data: any) {
    if (!data?.user?.companyId) {
      throw new RpcException(new BadRequestException('Payload incompleto: falta user.companyId'));
    }
    try {
      return await this.productsService.searchForReceipt(data.query ?? {}, data.user.companyId);
    } catch (error: any) {
      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) throw new RpcException(error);
      this.logger.error('Error en search_products_for_receipt', error?.stack ?? error);
      throw new RpcException(new InternalServerErrorException('Error interno en MS Inventario'));
    }
  }
}