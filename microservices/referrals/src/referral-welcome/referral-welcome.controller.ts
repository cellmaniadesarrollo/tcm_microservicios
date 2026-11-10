import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InternalAuthInterceptor } from '../interceptors/internal-auth.interceptor';
import { ReferralWelcomeService } from './referral-welcome.service';

@Controller()
@UseInterceptors(InternalAuthInterceptor)
export class ReferralWelcomeController {
  constructor(private readonly service: ReferralWelcomeService) {}

  @MessagePattern('referral.send_welcome')
  send(@Payload() p: { companyId: string; customerId: string; phone: string; firstName?: string }) {
    return this.service.sendWelcome({ ...p, source: { type: 'PURCHASE' } });
  }
}