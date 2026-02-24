import { Controller } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';
import { MessagePattern } from '@nestjs/microservices';

@Controller('catalogs')
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) { }
  async onModuleInit() {
    try {
      const data = await this.catalogsService.syncBranchModels()
      await this.catalogsService.populateIfEmpty()

    } catch (err) {
      console.log(process.env.MYSQL_DB_HOST1)
      console.error('❌ Error solicitando sincronización inicial :', err);
    }
  }
  @MessagePattern({ cmd: 'get_brands' })
  async listBrands() {
    return this.catalogsService.listBrands();
  }
  @MessagePattern({ cmd: 'find_models' })
  async findModels(data: { brandId: number }) {
    return this.catalogsService.getModelsByBrand(data.brandId);
  }
  @MessagePattern({ cmd: 'get_type_device' })
  async listTypeDevice() {
    return this.catalogsService.listDeviceTypes();
  }
  @MessagePattern({ cmd: 'get_order_status' })
  async listOrderStatus() {
    return this.catalogsService.listOrderStatus();
  }
  @MessagePattern({ cmd: 'get_newdata_catalog_orders' })
  async listAllCatalog() {
    return this.catalogsService.getOrderCatalog();
  }
}
