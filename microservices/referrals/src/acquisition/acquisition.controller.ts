import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InternalAuthInterceptor } from '../interceptors/internal-auth.interceptor';
import { AcquisitionService, SaveAcquisitionInput } from './acquisition.service';

@Controller()
@UseInterceptors(InternalAuthInterceptor)
export class AcquisitionController {
  constructor(private readonly service: AcquisitionService) {}

  @MessagePattern('acquisition.catalog')
  catalog(@Payload() p: { companyId: string }) {
    return this.service.getCatalog(p.companyId);
  }

  @MessagePattern('referral.validate_code')
  validateCode(@Payload() p: { companyId: string; code: string }) {
    return this.service.findReferrerByCode(p.companyId, p.code);
  }

  @MessagePattern('referral.search')
  search(@Payload() p: { companyId: string; q: string }) {
    return this.service.searchReferrers(p.companyId, p.q);
  }

  @MessagePattern('acquisition.save')
  save(@Payload() p: SaveAcquisitionInput) {
    return this.service.save(p);
  }
}