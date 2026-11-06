import { Controller, Get, Query } from '@nestjs/common';
import { Auth } from '../../common/auth/decorators/auth.decorator';
import { User } from '../../common/auth/decorators/user.decorator';
import { OrdersService } from './orders.service';
import { SearchOrdersQueryDto } from './dto/search-orders-query.dto';

@Controller('inventory-orders')
@Auth()
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    // GET /inventory-orders/search?search=#123
    @Get('search')
    search(@Query() query: SearchOrdersQueryDto, @User() user: any) {
        return this.ordersService.search(query, {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
        });
    }
}