import { Injectable } from '@nestjs/common';
import { InventoryCoreServiceClient } from '../../common/microservices/inventory-core-service-client';
import { CreateSupplierGatewayDto } from './dto/create-supplier-gateway.dto';
import { ListSuppliersQueryDto } from './dto/list-suppliers-query.dto';
import { UpdateSupplierGatewayDto } from './dto/update-supplier-gateway.dto';


type UserCtx = { userId: string; companyId: string; branchId?: string };

@Injectable()
export class SuppliersService {
    constructor(private readonly inventoryClient: InventoryCoreServiceClient) { }

    async getFormOptions(user: UserCtx) {
        return this.inventoryClient.send('get_supplier_form_options', { user });
    }
    async createSupplier(dto: CreateSupplierGatewayDto, user: UserCtx) {
        return this.inventoryClient.send('create_supplier', { dto, user });
    }
    async list(query: ListSuppliersQueryDto, user: UserCtx) {
        return this.inventoryClient.send('list_suppliers', { query, user });
    }

    async getFullData(id: string, user: UserCtx) {
        return this.inventoryClient.send('get_supplier_full_data', { id, user });
    }
    async updateSupplier(id: string, dto: UpdateSupplierGatewayDto, user: UserCtx) {
        return this.inventoryClient.send('update_supplier', { id, dto, user });
    }

    async updateSupplierStatus(id: string, status: boolean, user: UserCtx) {
        return this.inventoryClient.send('update_supplier_status', { id, status, user });
    }

}