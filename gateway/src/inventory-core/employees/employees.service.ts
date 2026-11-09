import { Injectable } from '@nestjs/common';
import { InventoryCoreServiceClient } from '../../common/microservices/inventory-core-service-client';

@Injectable()
export class EmployeesService {
    constructor(private readonly inventoryClient: InventoryCoreServiceClient) { }

    listBasic(user: { userId: string; companyId: string; branchId?: string }) {
        return this.inventoryClient.send('get_employees_basic', { user });
    }
}