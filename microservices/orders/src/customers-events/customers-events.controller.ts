import { Controller, Inject, OnModuleInit } from '@nestjs/common';
import { ClientsModule, ClientProxy, MessagePattern, Payload } from '@nestjs/microservices';
import { CustomersEventsService } from './customers-events.service';
import { firstValueFrom } from 'rxjs';
@Controller('customers-events')
export class CustomersEventsController {
  constructor(
    private readonly cacheService: CustomersEventsService,
    @Inject('CUSTOMER_ASYNC') private readonly customerClient: ClientProxy,
  ) { }

  async onModuleInit() {
    try {
      const timestamps = await this.cacheService.getLastTimestamps();

      const response = await firstValueFrom(
        this.customerClient.send(
          { cmd: 'async_customers_start' }, 
          {
            internalToken: process.env.INTERNAL_SECRET,
            fromCache: timestamps,
          }
        )
      );
      await this.cacheService.syncCustomersBulk(response)
    } catch (err) {
      console.error('❌ Error solicitando sincronización inicial :', err);
    }
  }

    @MessagePattern({ cmd: 'find_customer' })
    async list(@Payload() data: any) {
     
        const { find,user} = data; 
        return  this.cacheService.searchCustomers( find,user);
    }
}
