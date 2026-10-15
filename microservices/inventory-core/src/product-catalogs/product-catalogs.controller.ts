import { Controller } from '@nestjs/common';
import { ProductCatalogsService } from './product-catalogs.service';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';

@Controller('product-catalogs')
export class ProductCatalogsController {
  constructor(private readonly productCatalogsService: ProductCatalogsService) { }

  @MessagePattern({ cmd: 'get_part_request_form_options' })
  async getPartRequestFormOptions(@Payload() data: any) {
    try {
      if (!data?.user?.companyId) {
        throw new RpcException('Payload incompleto: falta user.companyId');
      }
      return await this.productCatalogsService.getPartRequestFormOptions(data.user.companyId);
    } catch (error: any) {
      console.error('🔥 Error en getPartRequestFormOptions:', error);
      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Inventario',
        details: error.response || null,
      });
    }
  }
  @MessagePattern({ cmd: 'find_models_by_brand' })
  async findModelsByBrand(@Payload() data: any) {
    try {
      const brandId = Number(data?.brandId);
      if (!Number.isInteger(brandId) || brandId < 1) {
        throw new RpcException('brandId inválido');
      }
      return await this.productCatalogsService.findModelsByBrand(brandId, data?.search);
    } catch (error: any) {
      console.error('🔥 Error en findModelsByBrand:', error);
      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Inventario',
        details: error.response || null,
      });
    }
  }
}
