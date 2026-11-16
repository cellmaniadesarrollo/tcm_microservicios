import { BadRequestException, Controller, HttpException, InternalServerErrorException, Logger } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { StockVouchersService } from './stock-vouchers.service';

@Controller('stock-vouchers-cancellation')
export class StockVouchersCancellationController {
    private readonly logger = new Logger(StockVouchersCancellationController.name);

    constructor(private readonly service: StockVouchersService) { }

    @MessagePattern({ cmd: 'approve_spare_cancellation' })
    async approve(@Payload() data: any) {
        return this.run('approve_spare_cancellation', async () => {
            const companyId = data?.user?.companyId;
            const userId = data?.user?.userId;
            if (!companyId || !userId) {
                throw new RpcException(
                    new BadRequestException('Payload incompleto: falta user.companyId o user.userId'),
                );
            }
            return this.service.approveCancellation(String(data?.id ?? ''), data?.dto ?? {}, String(companyId), String(userId));
        });
    }

    private async run<T>(name: string, fn: () => Promise<T>): Promise<T> {
        try {
            return await fn();
        } catch (error: any) {
            if (error instanceof RpcException) throw error;
            if (error instanceof HttpException) throw new RpcException(error);
            this.logger.error(`Error en ${name}`, error?.stack ?? error);
            throw new RpcException(new InternalServerErrorException('Error interno en MS Inventario'));
        }
    }
}