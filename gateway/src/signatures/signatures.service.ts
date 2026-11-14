import { Injectable } from '@nestjs/common';
import { BillingServiceClient } from '../common/microservices/billing-service-client';
import { CreateSignatureGatewayDto } from './dto/create-signature-gateway.dto';

type UserCtx = { userId: string; companyId: string; branchId?: string };

@Injectable()
export class SignaturesService {
    constructor(private readonly billing: BillingServiceClient) { }

    list(user: UserCtx) {
        return this.billing.send('list_signatures', { user });
    }

    getNewData(user: UserCtx) {
        return this.billing.send('get_signature_new_data', { user });
    }

    create(dto: CreateSignatureGatewayDto, file: unknown, user: UserCtx) {
        return this.billing.send('create_signature', { dto, file, user }, 30000);
    }

    updateBranches(id: string, branchIds: string[], user: UserCtx) {
        return this.billing.send('update_signature_branches', { id, dto: { branchIds }, user });
    }
}