import { Injectable } from '@nestjs/common';
import { InventoryCoreServiceClient } from '../../common/microservices/inventory-core-service-client';
import { ListSpareCancellationsQueryDto } from './dto/list-spare-cancellations-query.dto';
import { RejectSpareCancellationDto } from './dto/reject-spare-cancellation.dto';
import { ApproveSpareCancellationDto } from './dto/approve-spare-cancellation.dto';

type UserCtx = { userId: string; companyId: string; branchId?: string };

@Injectable()
export class SpareCancellationsService {
    constructor(private readonly inventoryClient: InventoryCoreServiceClient) { }

    list(query: ListSpareCancellationsQueryDto, user: UserCtx) {
        return this.inventoryClient.send('list_spare_cancellations', { query, user });
    }
    reject(id: string, dto: RejectSpareCancellationDto, user: UserCtx) {
        return this.inventoryClient.send('reject_spare_cancellation', { id, dto, user });
    }
    approve(id: string, dto: ApproveSpareCancellationDto, user: UserCtx) {
        return this.inventoryClient.send('approve_spare_cancellation', { id, dto, user });
    }
}