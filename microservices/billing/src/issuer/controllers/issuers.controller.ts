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

  @MessagePattern({ cmd: 'list_emission_points' })
  listEmissionPoints(@Payload() d: any) {
    return this.service.listEmissionPoints(d.user.companyId, d.branchId);
  }

  @MessagePattern({ cmd: 'create_emission_point' })
  createEmissionPoint(@Payload() d: any) {
    return this.service.createEmissionPoint(d.user.companyId, d.branchId, d.dto);
  }

  @MessagePattern({ cmd: 'update_emission_point' })
  updateEmissionPoint(@Payload() d: any) {
    return this.service.updateEmissionPoint(d.user.companyId, d.id, d.dto);
  }

    @MessagePattern({ cmd: 'list_my_emission_points' })
  listMine(@Payload() d: any) {
    return this.service.listMyEmissionPoints(d.user.companyId, d.branchId, d.user.userId);
  }

  @MessagePattern({ cmd: 'get_emission_point_users' })
  getUsers(@Payload() d: any) {
    return this.service.getEmissionPointUsers(d.user.companyId, d.id);
  }

  @MessagePattern({ cmd: 'set_emission_point_users' })
  setUsers(@Payload() d: any) {
    return this.service.setEmissionPointUsers(d.user.companyId, d.id, d.dto.userIds);
  }
}