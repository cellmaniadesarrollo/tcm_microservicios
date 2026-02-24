import { Controller } from '@nestjs/common';
import { SubscriptionsModuleService } from './subscriptions-module.service';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller('subscriptions-module')
export class SubscriptionsModuleController {
  constructor(private readonly subscriptionsModuleService: SubscriptionsModuleService) {
    
  }


  @MessagePattern({ cmd: 'validate_company_subscription' })
  async validateCompanySubscription(
    @Payload()
    data: {
      companyId: string; 
    },
  ) {
    return this.subscriptionsModuleService.validateCompanySubscription(
      data.companyId  
    );
  }
@MessagePattern({ cmd: 'validate_company_user_limit' })
async validateCompanyUserLimit(
  @Payload() data: { companyId: string },
) {
  return this.subscriptionsModuleService.validateCompanyUserLimit(
    data.companyId,
  );
}
}
