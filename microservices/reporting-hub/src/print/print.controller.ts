import { Controller } from '@nestjs/common';
import { PrintService } from './print.service';
import { MessagePattern } from '@nestjs/microservices';
import { RegisterOrderPrintDto } from './dto/register-order-print.dto';
import { PrintableType } from './schemas/order-print-status.schema';
import { RegisterPrintCopyDto } from './dto/register-print-copy.dto';

@Controller('print')
export class PrintController {
  constructor(private readonly printService: PrintService) { }


  @MessagePattern({ cmd: 'register_order_print' })
  async registerOrderPrint(data: {
    user: { userId: string; companyId: string; branchId: string };
    data: RegisterOrderPrintDto;
  }) {
    return this.printService.registerPrint(data.user, data.data);
  }
  @MessagePattern({ cmd: 'get_print_status' })
  async getPrintStatus(payload: any) {

    const { entity_type, orderId, paymentId } = payload.data;
    const result = await this.printService.getPrintStatus(
      entity_type,
      orderId,
      paymentId,
    );
    return result;
  }
  @MessagePattern({ cmd: 'register_print_copy' })
  async registerPrintCopy(data: {
    user: { userId: string; companyId: string; branchId: string };
    data: RegisterPrintCopyDto;
  }) {
    return this.printService.registerPrintCopy(data.user, data.data);
  }
}
