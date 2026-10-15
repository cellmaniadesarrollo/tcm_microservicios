import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Public } from '../../common/auth/decorators/public.decorator';
import { OrdersGatewayService } from '../orders.service';
import { RegisterKeyGuard } from './guard/register-key.guard';
import { RegisterPrintEndpointGatewayDto } from './dto/register-print-endpoint-gateway.dto';

@Controller('print-endpoints')
export class PrintEndpointsController {
  constructor(private readonly ordersGatewayService: OrdersGatewayService) {}

  // Lo llama tunnel.py. Sin JWT, protegido por x-register-key.
  @Post('register')
  @Public()
  @UseGuards(RegisterKeyGuard)
  register(@Body() dto: RegisterPrintEndpointGatewayDto) {
    return this.ordersGatewayService.registerPrintEndpoint(dto);
  }
}