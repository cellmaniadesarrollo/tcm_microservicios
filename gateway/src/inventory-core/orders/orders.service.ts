import { Injectable } from '@nestjs/common';
import { InventoryCoreServiceClient } from '../../common/microservices/inventory-core-service-client';
import { SearchOrdersQueryDto } from './dto/search-orders-query.dto';

@Injectable()
export class OrdersService {
    constructor(private readonly inventoryClient: InventoryCoreServiceClient) { }

    search(
        query: SearchOrdersQueryDto,
        user: { userId: string; companyId: string; branchId?: string },
    ) {
        return this.inventoryClient.send('search_orders', {
            search: query.search,
            user,
        });
    }
}