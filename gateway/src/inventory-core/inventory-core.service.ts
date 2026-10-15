import { Injectable } from '@nestjs/common';
import { InventoryCoreServiceClient } from '../common/microservices/inventory-core-service-client';
import { CreateProductGatewayDto } from './dto/create-product-gateway.dto';

@Injectable()
export class InventoryCoreService {
    constructor(private readonly inventoryClient: InventoryCoreServiceClient) { }

    async getPartRequestFormOptions(user: { userId: string; companyId: string; branchId?: string }) {
        return this.inventoryClient.send('get_part_request_form_options', { user });
    }
    // inventory-core.service.ts
    async createProduct(
        dto: CreateProductGatewayDto,
        user: { userId: string; companyId: string; branchId?: string },
    ) {
        return this.inventoryClient.send('create_product', { dto, user });
    }
    async findModelsByBrand(brandId: number, search?: string) {
        return this.inventoryClient.send('find_models_by_brand', { brandId, search });
    }
}