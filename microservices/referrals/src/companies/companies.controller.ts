import { Controller, Inject, OnApplicationBootstrap } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

@Controller('companies')
export class CompaniesController implements OnApplicationBootstrap {
  constructor(
    private readonly companiesService: CompaniesService,
    @Inject('COMPANIES_ASYNC') private readonly customerClient: ClientProxy,
  ) {}

  onApplicationBootstrap() {
    // sin await: no bloquea el arranque
    this.initialSync().catch((err) =>
      console.error('❌ Error en sincronización inicial de companies:', err?.message ?? err),
    );
  }

  private async initialSync() {
    const timestamps = await this.companiesService.getLastUpdatedAt();
    const response = await firstValueFrom(
      this.customerClient
        .send(
          { cmd: 'async_companies_start' },
          { internalToken: process.env.INTERNAL_SECRET, fromCache: timestamps },
        )
        .pipe(timeout(15000)),
    );
    await this.companiesService.syncCompanyBulk(response);
  }
}