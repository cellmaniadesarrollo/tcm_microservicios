import { Controller, Inject, OnModuleInit } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('companies')
export class CompaniesController implements OnModuleInit {
    constructor(
        private readonly companiesService: CompaniesService,
        @Inject('COMPANIES_ASYNC') private readonly customerClient: ClientProxy,
    ) { }

    onModuleInit() {
        // Lanza en segundo plano y NO hagas await
        this.syncCompaniesInBackground().catch((err) => {
            console.error('❌ Error solicitando sincronización inicial:', err);
        });
    }

    private async syncCompaniesInBackground() {
        const timestamps = await this.companiesService.getLastUpdatedAt();

        const response = await firstValueFrom(
            this.customerClient.send(
                { cmd: 'async_companies_start' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    fromCache: timestamps,
                },
            ),
        );

        await this.companiesService.syncCompanyBulk(response);
    }
}