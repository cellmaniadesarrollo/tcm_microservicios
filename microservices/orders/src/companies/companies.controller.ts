import { Controller, Inject, OnModuleInit } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

@Controller('companies')
export class CompaniesController implements OnModuleInit {
    constructor(
        private readonly companiesService: CompaniesService,
        @Inject('COMPANIES_ASYNC') private readonly customerClient: ClientProxy,
    ) { }

    /** No bloquea el arranque: la sync corre en segundo plano. */
    onModuleInit() {
        void this.syncOnStart();
    }

    private async syncOnStart() {
        try {
            const timestamps = await this.companiesService.getLastUpdatedAt();
            const response = await firstValueFrom(
                this.customerClient
                    .send(
                        { cmd: 'async_companies_start' },
                        {
                            internalToken: process.env.INTERNAL_SECRET,
                            fromCache: timestamps,
                        },
                    )
                    .pipe(timeout(30000)),
            );
            // console.log(JSON.stringify(response , null, 2));
            await this.companiesService.syncCompanyBulk(response);
        } catch (err: any) {
            console.warn('⚠️ Sync inicial de companies omitida:', err?.message ?? err);
        }
    }
}