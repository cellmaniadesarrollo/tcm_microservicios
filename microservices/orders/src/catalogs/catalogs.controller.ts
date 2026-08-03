import { Controller } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';
import { MessagePattern, Payload } from '@nestjs/microservices';

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

  @MessagePattern({ cmd: 'async_normalizations_start' })
  async onNormalizationsSync() {
    return await this.catalogsService.getNormalizationsData();
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

  // GET países → { id, name }
  @MessagePattern({ cmd: 'get_geo_countries' })
  async getCountries() {
    return this.catalogsService.getCountries();
  }

  // GET provincias por país → { id, name }
  @MessagePattern({ cmd: 'get_geo_provinces' })
  async getProvinces(@Payload() payload: { country_id: number }) {
    return this.catalogsService.getDivisionsByParent(null, payload.country_id, 1);
  }

  // GET ciudades por provincia → { id, name }
  @MessagePattern({ cmd: 'get_geo_cities' })
  async getCities(@Payload() payload: { province_id: number }) {
    return this.catalogsService.getDivisionsByParent(payload.province_id, null, 2);
  }
}
