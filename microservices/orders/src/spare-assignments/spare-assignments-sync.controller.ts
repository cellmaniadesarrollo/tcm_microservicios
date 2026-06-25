// src/spare-assignments/spare-assignments-sync.controller.ts
import { Controller, Inject, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { SpareAssignmentsService } from './spare-assignments.service';

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
}