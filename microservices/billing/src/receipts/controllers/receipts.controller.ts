import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InternalAuthInterceptor } from '../../interceptors/internal-auth.interceptor';
import { ReceiptsService } from '../services/receipts.service';

@Controller()
@UseInterceptors(InternalAuthInterceptor)
export class ReceiptsController {
  constructor(private readonly service: ReceiptsService) {}

  @MessagePattern({ cmd: 'create_receipt' })
  create(@Payload() d: any) {
    return this.service.createReceipt(d.user.companyId, d.user.userId, d.dto);
  }

  @MessagePattern({ cmd: 'list_receipts' })
  list(@Payload() d: any) {
    return this.service.list(d.user.companyId);
  }
}