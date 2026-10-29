// receipts.service.ts
import { Injectable } from '@nestjs/common';
import { InventoryCoreServiceClient } from '../../common/microservices/inventory-core-service-client';
import { CreateReceiptGatewayDto } from './dto/create-receipt-gateway.dto';
import { SearchReceiptProductsQueryDto } from './dto/search-receipt-products-query.dto';
import { SearchSuppliersQueryDto } from './dto/search-suppliers-query.dto';
import { ReceiptFilesPayload } from './helpers/receipt-attachments.helper';
import { ListReceiptsQueryDto } from './dto/list-receipts-query.dto';
import { CreateReceiptPaymentGatewayDto } from './dto/create-receipt-payment-gateway.dto';
import { VoidReceiptPaymentGatewayDto } from './dto/void-receipt-payment-gateway.dto';

type UserCtx = { userId: string; companyId: string; branchId?: string };

@Injectable()
export class ReceiptsService {
    constructor(private readonly inventoryClient: InventoryCoreServiceClient) { }

    async getNewData(user: UserCtx) {
        return this.inventoryClient.send('get_receipt_new_data', { user });
    }
    // service del gateway: debe aceptar 3 parámetros
    async create(dto: CreateReceiptGatewayDto, files: ReceiptFilesPayload, user: UserCtx) {
        return this.inventoryClient.send('create_receipt', { dto, files, user });
    }
    async searchProducts(query: SearchReceiptProductsQueryDto, user: UserCtx) {
        return this.inventoryClient.send('search_products_for_receipt', { query, user });
    }
    async search(query: SearchSuppliersQueryDto, user: UserCtx) {
        return this.inventoryClient.send('search_suppliers', { query, user });
    }
    async list(query: ListReceiptsQueryDto, user: UserCtx) {
        return this.inventoryClient.send('list_receipts', { query, user });
    }
    async addPayment(receiptId: string, dto: CreateReceiptPaymentGatewayDto, file: unknown, user: UserCtx) {
        return this.inventoryClient.send('add_receipt_payment', { receiptId, dto, file, user });
    }

    async voidPayment(receiptId: string, paymentId: string, dto: VoidReceiptPaymentGatewayDto, user: UserCtx) {
        return this.inventoryClient.send('void_receipt_payment', { receiptId, paymentId, dto, user });
    }
    async getDetail(receiptId: string, user: UserCtx) {
        return this.inventoryClient.send('get_receipt_detail', { receiptId, user });
    }




}