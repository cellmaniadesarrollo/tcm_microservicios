import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InternalAuthInterceptor } from '../interceptors/internal-auth.interceptor';
import { ReferralClaimsService } from './referral-claims.service';

@Controller()
@UseInterceptors(InternalAuthInterceptor)
export class ReferralClaimsController {
  constructor(private readonly service: ReferralClaimsService) {}

  @MessagePattern('referral.claims_by_document')
  byDocument(@Payload() p: { companyId: string; document: string }) {
    return this.service.findByReferrerDocument(p.companyId, p.document);
  }
}