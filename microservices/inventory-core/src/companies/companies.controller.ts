import { Controller, Inject } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';


@Controller('companies')
export class CompaniesController {
constructor(private readonly companiesService: CompaniesService,
    @Inject('COMPANIES_ASYNC') private readonly customerClient: ClientProxy,
  ) {}
      async onModuleInit() {
        try {
          const timestamps = await this.companiesService.getLastUpdatedAt(); 
            const response = await firstValueFrom(
                this.customerClient.send(
                    { cmd: 'async_companies_start' },  
                    {
                        internalToken: process.env.INTERNAL_SECRET,
                        fromCache: timestamps,
                    } 
                )
            );  
            // console.log(JSON.stringify(response , null, 2));
           await this.companiesService.syncCompanyBulk(response)
        } catch (err) {
            console.error('❌ Error solicitando sincronización inicial :', err);
        }
    } 
}
