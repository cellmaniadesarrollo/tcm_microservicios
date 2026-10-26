import { Injectable } from '@nestjs/common';
import { InventoryCoreServiceClient } from '../common/microservices/inventory-core-service-client';
import { CreateProductGatewayDto } from './dto/create-product-gateway.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { UpdateProductGatewayDto } from './dto/update-product-gateway.dto';
type UserCtx = { userId: string; companyId: string; branchId?: string };
@Injectable()
export class InventoryCoreService {
    constructor(private readonly inventoryClient: InventoryCoreServiceClient) { }

    async getPartRequestFormOptions(user: { userId: string; companyId: string; branchId?: string }) {
        return this.inventoryClient.send('get_part_request_form_options', { user });
    }
    // inventory-core.service.ts
    async createProduct(dto: CreateProductGatewayDto, files: unknown[], user: UserCtx) {
        return this.inventoryClient.send('create_product', { dto, files, user });
    }
    async findModelsByBrand(brandId: number, search?: string) {
        return this.inventoryClient.send('find_models_by_brand', { brandId, search });
    }


    addProductImages(productId: string, files: unknown[], user: UserCtx) {
        return this.inventoryClient.send('add_product_images', { productId, files, user });
    }
    listProductImages(productId: string, user: UserCtx) {
        return this.inventoryClient.send('list_product_images', { productId, user });
    }
    setPrimaryProductImage(productId: string, imageId: string, user: UserCtx) {
        return this.inventoryClient.send('set_primary_product_image', { productId, imageId, user });
    }
    reorderProductImages(productId: string, imageIds: string[], user: UserCtx) {
        return this.inventoryClient.send('reorder_product_images', { productId, imageIds, user });
    }
    removeProductImage(productId: string, imageId: string, user: UserCtx) {
        return this.inventoryClient.send('remove_product_image', { productId, imageId, user });
    }

    listProducts(query: ListProductsQueryDto, user: UserCtx) {
        return this.inventoryClient.send('list_products', { query, user });
    }
    getProductFilters(user: UserCtx) {
        return this.inventoryClient.send('get_product_filters', { user });
    }

    updateProduct(id: string, dto: UpdateProductGatewayDto, user: UserCtx) {
        return this.inventoryClient.send('update_product', { id, dto, user });
    }

    deleteProduct(id: string, user: UserCtx) {
        return this.inventoryClient.send('delete_product', { id, user });
    }
    getProduct(id: string, user: UserCtx) {
        console.log(id)
        return this.inventoryClient.send('get_product', { id, user });
    }

    getProductHistory(id: string, page: number, limit: number, user: UserCtx) {
        return this.inventoryClient.send('get_product_history', { id, page, limit, user });
    }
}