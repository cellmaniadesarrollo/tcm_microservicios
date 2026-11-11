// microservices/orders/src/order-part-request/part-request-report.controller.ts

import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { PartRequestReportService } from './part-request-report.service';

@Controller('order-part-request-report')
export class PartRequestReportController {
    constructor(private readonly reportService: PartRequestReportService) { }

    /** Reporte detallado de repuestos hallados a nivel nacional */
    @MessagePattern({ cmd: 'report_national_sourcing' })
    async list(@Payload() data: any) {
        return this.handle('report_national_sourcing', data, () =>
            this.reportService.list(data.dto, data.user),
        );
    }

    /** Resumen agrupado por empleado que encontró */
    @MessagePattern({ cmd: 'report_national_sourcing_summary' })
    async summary(@Payload() data: any) {
        return this.handle('report_national_sourcing_summary', data, () =>
            this.reportService.summaryByEmployee(data.dto, data.user),
        );
    }

    private async handle<T>(name: string, data: any, fn: () => Promise<T>): Promise<T> {
        try {
            if (!data?.dto || !data?.user) {
                console.error('❌ Error: Payload incompleto', data);
                throw new RpcException('Payload incompleto: falta dto o user');
            }
            return await fn();
        } catch (error: any) {
            console.error(`🔥 Error crítico en MS Órdenes (${name}):`, error);
            if (error.stack) console.error(error.stack);

            throw new RpcException({
                status: 'error',
                message: error.message || 'Error interno en MS Órdenes',
                details: error.response || null,
            });
        }
    }
}