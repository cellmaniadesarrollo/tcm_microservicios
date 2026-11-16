import { BadRequestException, Controller, HttpException, InternalServerErrorException, Logger } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { SpareCancellationsService } from '../services/spare-cancellations.service';

@Controller('spare-cancellations')
export class SpareCancellationsController {
    private readonly logger = new Logger(SpareCancellationsController.name);

    constructor(private readonly service: SpareCancellationsService) { }

    @MessagePattern({ cmd: 'list_spare_cancellations' })
    async list(@Payload() data: any) {
        return this.run('list_spare_cancellations', async () => {
            const { companyId, userId } = this.ctx(data);
            void userId;
            return this.service.list(data.query ?? {}, companyId);
        });
    }

    private ctx(data: any) {
        const companyId = data?.user?.companyId;
        const userId = data?.user?.userId;
        if (!companyId || !userId) {
            throw new RpcException(
                new BadRequestException('Payload incompleto: falta user.companyId o user.userId'),
            );
        }
        return { companyId: String(companyId), userId: String(userId) };
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
    @MessagePattern({ cmd: 'reject_spare_cancellation' })
    async reject(@Payload() data: any) {
        return this.run('reject_spare_cancellation', async () => {
            const { companyId, userId } = this.ctx(data);
            return this.service.reject(String(data?.id ?? ''), data?.dto?.reason, companyId, userId);
        });
    }
}