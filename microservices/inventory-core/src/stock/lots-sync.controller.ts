import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { StockService } from './stock.service';

@Controller()
export class LotsSyncController {
    constructor(private readonly stock: StockService) { }

    @MessagePattern({ cmd: 'get_lots_sync' })
    sync(@Payload() data: any) {
        return this.stock.syncLotsPage({
            cursor: data?.cursor ?? null,
            createdSince: data?.createdSince ?? null,
            limit: data?.limit,
        });
    }
}