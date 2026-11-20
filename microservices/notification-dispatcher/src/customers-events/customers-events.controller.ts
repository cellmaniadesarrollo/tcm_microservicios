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




}
