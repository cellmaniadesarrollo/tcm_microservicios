// reporting-hub-bootstrap.service.ts
import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ReportingHubService } from './reporting-hub.service';

@Injectable()
export class ReportingHubBootstrapService implements OnModuleInit {
    private readonly logger = new Logger(ReportingHubBootstrapService.name);

    constructor(
        private readonly eventsService: ReportingHubService,
        @Inject('REPORTING_HUB_ASYNC') private readonly reportingHubClient: ClientProxy,
    ) { }

    async onModuleInit() {
        try {
            await this.reportingHubClient.connect();
            this.logger.log('Iniciando sincronización de reporting hub...');

            const lastTimestamp = await this.eventsService.getLastTimestamp();

            const response = await firstValueFrom(
                this.reportingHubClient.send(
                    { cmd: 'async_validations_start' },
                    {
                        internalToken: process.env.INTERNAL_SECRET,
                        fromCache: lastTimestamp,
                    },
                ),
            );

            await this.eventsService.syncValidationsBulk(response);
            this.logger.log('✅ Sincronización inicial de validaciones completada');
        } catch (err) {
            this.logger.error('❌ Error en sincronización inicial de validaciones:', err);
        }
    }
}