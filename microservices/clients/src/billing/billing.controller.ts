import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
      constructor(private readonly billingService: BillingService) {}

  @MessagePattern({ cmd: 'create_billing' })
  create(@Payload() data: any) {
    return this.billingService.create(data);
  }

  @MessagePattern({ cmd: 'update_billing' })
  update(@Payload() data: any) {
     
    return this.billingService.update(data.id, data.updates );
  }
}
