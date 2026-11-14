import { Inject, UnauthorizedException } from '@nestjs/common';
import { Controller } from '@nestjs/common';
import { ClientProxy, MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { SpareAssignmentsSyncService } from '../services/spare-assignments-sync.service';

@Controller()
export class SpareAssignmentsSyncController {
    constructor(private readonly service: SpareAssignmentsSyncService,
    ) { }

    // Comando distinto al del legacy (async_spare_assignments_start) para no confundirlos.
    @MessagePattern({ cmd: 'async_core_spare_assignments_start' })
    async start(@Payload() payload: { internalToken?: string; fromCache?: string | null }) {
        const secret = process.env.INTERNAL_SECRET;
        if (!secret || payload?.internalToken !== secret) {
            throw new RpcException(new UnauthorizedException('Token interno inválido'));
        }
        const rows = await this.service.findForSync(payload?.fromCache ?? null);
        console.log(`📤 [Bulk] spare assignments inventory-core | fromCache: ${payload?.fromCache ?? 'inicio'} | filas: ${rows.length}`);
        return rows;
    }
}