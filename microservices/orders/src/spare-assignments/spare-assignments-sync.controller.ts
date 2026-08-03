// src/spare-assignments/spare-assignments-sync.controller.ts
import { Controller, Inject, OnModuleInit } from '@nestjs/common';
import { ClientProxy, Ctx, MessagePattern, Payload, RmqContext } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { SpareAssignmentsService } from './spare-assignments.service';
import { CreateCancellationRequestDto } from './dto/create-cancellation-request.dto';

@Controller()
export class SpareAssignmentsSyncController implements OnModuleInit {

    constructor(
        private readonly spareAssignmentsService: SpareAssignmentsService,
        @Inject('SPARE_ASSIGNMENTS_SYNC') private readonly syncClient: ClientProxy,
    ) { }

    async onModuleInit() {
        try {
            const fromCache = await this.spareAssignmentsService.getLastUpdatedAt();
            console.log(`🔄 Sincronizando spare assignments desde: ${fromCache ?? 'el origen del tiempo'}`);

            const response = await firstValueFrom(
                this.syncClient.send(
                    { cmd: 'async_spare_assignments_start' },
                    {
                        internalToken: process.env.INTERNAL_SECRET,
                        fromCache,
                    },
                ),
            );

            await this.spareAssignmentsService.syncBulk(response);
        } catch (err: any) {
            console.error('❌ Error en sync inicial de spare assignments:', err.message);
        }
    }

    @MessagePattern({ cmd: 'cancel_spare_assignment' })
    async cancelSpareAssignment(
        @Payload() payload: { 
            orderId: number;
            spareAssignmentId: string;
            dto: CreateCancellationRequestDto;
            user: { userId: string; companyId: string; branchId: string };
        },
    ) {
        return this.spareAssignmentsService.createCancellationRequest(
            payload.orderId,
            payload.spareAssignmentId,
            payload.dto,
            payload.user,
        );
    }


    // ── NUEVO: responde el bulk de solicitudes de cancelación a ms-inventory ──
    @MessagePattern({ cmd: 'async_spare_cancellations_start' })
    async onCancellationsSyncStart(
        @Payload() payload: any,
        @Ctx() context: RmqContext,
    ) {
        console.log('🔄 Sync cancelaciones solicitada | fromCache:', payload.fromCache ?? 'inicio');

        const result = await this.spareAssignmentsService.findCancellationRequestsForSync(payload.fromCache);
        console.log(`📤 Respuesta lista | cantidad: ${result?.length ?? 0}`);

        // ── Respuesta manual para el cliente amqplib de ms-inventory ──
        const originalMsg = context.getMessage();
        const replyTo = originalMsg.properties.replyTo;

        if (replyTo === 'inventory_spare_cancellations_sync_reply') {
            const ch = context.getChannelRef();
            ch.sendToQueue(
                'inventory_spare_cancellations_sync_reply',
                Buffer.from(JSON.stringify(result)),
                { correlationId: originalMsg.properties.correlationId },
            );
        }

        return result; // por si algún día se llama con ClientProxy de NestJS
    }
}