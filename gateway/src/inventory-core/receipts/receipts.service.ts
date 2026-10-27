// receipts.service.ts
import { Injectable } from '@nestjs/common';
import { InventoryCoreServiceClient } from '../../common/microservices/inventory-core-service-client';
import { CreateReceiptGatewayDto } from './dto/create-receipt-gateway.dto';
import { SearchReceiptProductsQueryDto } from './dto/search-receipt-products-query.dto';
import { SearchSuppliersQueryDto } from './dto/search-suppliers-query.dto';

type UserCtx = { userId: string; companyId: string; branchId?: string };

@Injectable()
export class ReceiptsService {
    constructor(private readonly inventoryClient: InventoryCoreServiceClient) { }

    async getNewData(user: UserCtx) {
        return this.inventoryClient.send('get_receipt_new_data', { user });
    }
    async create(dto: CreateReceiptGatewayDto, user: UserCtx) {
        return this.inventoryClient.send('create_receipt', { dto, user });
    }
    async searchProducts(query: SearchReceiptProductsQueryDto, user: UserCtx) {
        return this.inventoryClient.send('search_products_for_receipt', { query, user });
    }
    async search(query: SearchSuppliersQueryDto, user: UserCtx) {
        return this.inventoryClient.send('search_suppliers', { query, user });
    }
}