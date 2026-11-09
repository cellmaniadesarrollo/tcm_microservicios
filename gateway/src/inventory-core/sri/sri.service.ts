import { Injectable } from '@nestjs/common';
import { InventoryCoreServiceClient } from '../../common/microservices/inventory-core-service-client';
import { PreviewAccessKeyGatewayDto } from './dto/preview-access-key-gateway.dto';

type UserCtx = { userId: string; companyId: string; branchId?: string };

@Injectable()
export class SriService {
    constructor(private readonly inventoryClient: InventoryCoreServiceClient) { }

    async previewAccessKey(dto: PreviewAccessKeyGatewayDto, user: UserCtx) {
        return this.inventoryClient.send('sri_preview_access_key', { accessKey: dto.accessKey, user });
    }
}