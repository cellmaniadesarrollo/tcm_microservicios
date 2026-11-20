import { Controller, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { CompaniesService } from './companies.service';

const REQUEST_TIMEOUT_MS = 60_000;

@Controller('companies')
export class CompaniesController implements OnModuleInit {
    private readonly logger = new Logger(CompaniesController.name);

    constructor(
        private readonly companiesService: CompaniesService,
        @Inject('COMPANIES_ASYNC') private readonly companiesClient: ClientProxy,
    ) { }

    onModuleInit() {
        void this.initialSync();
    }

    private async initialSync() {
        try {
            const fromCache = await this.companiesService.getLastUpdatedAt();
            const response = await firstValueFrom(
                this.companiesClient
                    .send(
                        { cmd: 'async_companies_start' },
                        { internalToken: process.env.INTERNAL_SECRET, fromCache },
                    )
                    .pipe(timeout(REQUEST_TIMEOUT_MS)),
            );
            await this.companiesService.syncCompanyBulk(response);
            this.logger.log('✅ Sync inicial de empresas completado');
        } catch (err: any) {
            this.logger.error(`❌ Sync inicial de empresas falló: ${err?.message}`);
        }
    }
}