import { Controller } from '@nestjs/common';
import { ProductsService } from './products.service';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  @MessagePattern({ cmd: 'create_product' })
  async createProduct(@Payload() data: any) {
    try {
      if (!data?.dto || !data?.user?.companyId) {
        throw new RpcException('Payload incompleto: falta dto o user.companyId');
      }
      return await this.productsService.create(data.dto, data.user.companyId);
    } catch (error: any) {
      console.error('🔥 Error en createProduct:', error);
      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Inventario',
        details: error.response || null,
      });
    }
  }
}
