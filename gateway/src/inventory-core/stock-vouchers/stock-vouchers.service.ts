import { Injectable } from '@nestjs/common';
import { InventoryCoreServiceClient } from '../../common/microservices/inventory-core-service-client';
import { CreateStockVoucherGatewayDto } from './dto/create-stock-voucher-gateway.dto';
import { ListStockVouchersQueryDto } from './dto/list-stock-vouchers-query.dto';
import { StockVoucherFilesPayload } from './helpers/stock-voucher-attachments.helper';

type UserCtx = { userId: string; companyId: string; branchId?: string };

@Injectable()
export class StockVouchersService {
    constructor(private readonly inventoryClient: InventoryCoreServiceClient) { }

    async getNewData(user: UserCtx) {
        return this.inventoryClient.send('get_stock_voucher_new_data', { user });
    }

    async create(dto: CreateStockVoucherGatewayDto, files: StockVoucherFilesPayload, user: UserCtx) {
        return this.inventoryClient.send('create_stock_voucher', { dto, files, user });
    }

    async list(query: ListStockVouchersQueryDto, user: UserCtx) {
        return this.inventoryClient.send('list_stock_vouchers', { query, user });
    }

    async getDetail(id: string, user: UserCtx) {
        return this.inventoryClient.send('get_stock_voucher_detail', { id, user });
    }

    async getOrderSummary(orderId: number, user: UserCtx) {
        return this.inventoryClient.send('get_order_stock_summary', { orderId, user });
    }

    async searchLots(productId: string, user: UserCtx) {
        return this.inventoryClient.send('search_stock_voucher_lots', { productId, user });
    }

    async listLotUnits(lotId: string, user: UserCtx) {
        return this.inventoryClient.send('list_stock_voucher_lot_units', { lotId, user });
    }
}