import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { SyncGateway } from '../../sync/sync.gateway';

@Controller()
export class AuthorizationRealtimeController {
    constructor(private readonly gateway: SyncGateway) { }

    @EventPattern('customer.authorization.approved')
    handleApproved(data: any) {
        const { requestedByUserId, authorizationId, usableUntil, approvedByName } = data ?? {};
        if (!requestedByUserId || !authorizationId) {
            console.warn('[Auth] customer.authorization.approved sin requestedByUserId/authorizationId');
            return;
        }

        // Solo al solicitante, nunca a la sala de la compañía
        this.gateway.server
            .to(`user:${requestedByUserId}`)
            .emit('customer.authorization.approved', { authorizationId, usableUntil, approvedByName });

        console.log(`✅ [Auth] aprobación ${authorizationId} enviada a user:${requestedByUserId}`);
    }
}