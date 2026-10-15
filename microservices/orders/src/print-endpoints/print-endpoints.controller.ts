import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { InternalAuthInterceptor } from '../interceptors/internal-auth.interceptor';
import { PrintEndpointsService } from './print-endpoints.service';

@Controller()
@UseInterceptors(InternalAuthInterceptor)
export class PrintEndpointsController {
  constructor(private readonly service: PrintEndpointsService) {}

  @MessagePattern({ cmd: 'register_print_endpoint' })
  async register(@Payload() p: any) {
    try {
      const { company_id, code_establecimiento, url } = p.dto;
      return await this.service.save(String(company_id), code_establecimiento, url);
    } catch (e: any) {
      throw new RpcException({ status: e.getStatus?.() ?? 500, message: e.message });
    }
  }

  @MessagePattern({ cmd: 'get_print_endpoint' })
  async get(@Payload() p: any) {
    console.log('[print-endpoint] payload user:', JSON.stringify(p.user), 'code:', p.code);
    try {
      const branch = p.code ?? p.user?.branchId;
      if (branch == null) {
        throw new RpcException({ status: 400, message: 'branchId no viene en el token' });
      }
      return await this.service.get(String(p.user.companyId), String(branch));
    } catch (e: any) {
      if (e instanceof RpcException) throw e;
      throw new RpcException({ status: e.getStatus?.() ?? 500, message: e.message });
    }
  }
}