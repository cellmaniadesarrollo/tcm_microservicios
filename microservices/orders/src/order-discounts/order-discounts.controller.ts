import { Controller } from '@nestjs/common';
import { OrderDiscountsService } from './order-discounts.service';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { CreateOrderDiscountDto } from './dto/create-order-discount.dto';
import { CancelOrderDiscountDto } from './dto/cancel-order-discount.dto';
import { ListOrderDiscountsDto } from './dto/list-order-discounts.dto';
interface RpcUserContext {
  userId: string;
  companyId: string;
  branchId: string;
}

@Controller('order-discounts')
export class OrderDiscountsController {
  constructor(private readonly orderDiscountsService: OrderDiscountsService) { }

  @MessagePattern({ cmd: 'create_order_discount' })
  createOrderDiscount(
    @Payload() payload: { dto: CreateOrderDiscountDto; user: RpcUserContext },
  ) {
    return this.orderDiscountsService.create(payload.dto, payload.user);
  }

  @MessagePattern({ cmd: 'cancel_order_discount' })
  cancelOrderDiscount(
    @Payload() payload: { dto: CancelOrderDiscountDto; user: RpcUserContext },
  ) {
    return this.orderDiscountsService.cancel(payload.dto, payload.user);
  }
  @MessagePattern({ cmd: 'list_order_discounts' })
  listOrderDiscounts(
    @Payload() payload: { dto: ListOrderDiscountsDto; user: RpcUserContext },
  ) {
    console.log(payload.dto)
    return this.orderDiscountsService.list(payload.dto, payload.user);
  }
}
