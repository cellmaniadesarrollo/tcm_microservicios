import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InternalAuthInterceptor } from '../../interceptors/internal-auth.interceptor';
import { IssuersService } from '../services/issuers.service';

@Controller()
@UseInterceptors(InternalAuthInterceptor)
export class IssuersController {
  constructor(private readonly service: IssuersService) {}

  @MessagePattern({ cmd: 'create_issuer' })
  create(@Payload() d: any) { return this.service.create(d.user.companyId, d.dto); }

  @MessagePattern({ cmd: 'list_issuers' })
  list(@Payload() d: any) { return this.service.list(d.user.companyId); }

  @MessagePattern({ cmd: 'update_issuer' })
  update(@Payload() d: any) { return this.service.update(d.user.companyId, d.id, d.dto); }
}