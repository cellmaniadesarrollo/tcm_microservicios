import { Controller, Post, Query } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
@Controller('catalogs')
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) { }

  // Llama: /catalogs/seed-ecuador?remote=true
@MessagePattern({ cmd: 'initialdata_generate_catalogs' })
  seedCatalogs() {
    // Retornamos un mensaje indicando que el proceso ahora es automático
    return { 
      status: 'deprecated',
      message: 'Este endpoint ya no está disponible. Los catálogos ahora se inicializan automáticamente al arrancar el servicio.' 
    };
  }
  @MessagePattern({ cmd: 'get_newdata_catalog_clients' })
  async getInitialCatalogs(@Payload() data: any) {
    return this.catalogsService.getInitialCatalogs();
  }

  @MessagePattern({ cmd: 'find_city_catalog_clients' })
  async getCitiesByProvince(@Payload() data: any) {
    const provinceId = Number(data.provinceId);

    if (!provinceId) {
      throw new RpcException('provinceId es requerido');
    }

    return this.catalogsService.getCitiesByProvince(provinceId);
  }

  @MessagePattern({ cmd: 'get_newdata_catalog_clients_billing' })
  async getInitialCatalogsBilling(@Payload() data: any) {
    return this.catalogsService.getInitialCatalogsBilling();
  }
}
