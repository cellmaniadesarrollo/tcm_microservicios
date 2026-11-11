// gateway/src/orders/part-request-reports.controller.ts

import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { Auth } from '../../common/auth/decorators/auth.decorator';
import { Features } from '../../common/auth/decorators/features.decorator';
import { Groups } from '../../common/auth/decorators/groups.decorator';
import { User } from '../../common/auth/decorators/user.decorator';

import { PartRequestReportsGatewayService } from './part-request-reports-gateway.service';
import { NationalSourcingReportGatewayDto } from './dto/national-sourcing-report-gateway.dto';

@Controller('part-request-reports')
@Auth()
@Features('orders')
export class PartRequestReportsController {
    constructor(private readonly reportsGatewayService: PartRequestReportsGatewayService) { }

    // TODO: confirmar grupos autorizados para ver el reporte
    @Groups('ORDER_AUDIT', 'LOGISTICA_REPUESTOS')
    @Get('national-sourcing')
    async listNationalSourcing(@Query() query: Record<string, any>, @User() user: any) {
        const dto = await this.parseQuery(query);
        return this.reportsGatewayService.listNationalSourcing(dto, {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
        });
    }

    @Groups('ORDER_AUDIT', 'LOGISTICA_REPUESTOS')
    @Get('national-sourcing/summary')
    async summaryNationalSourcing(@Query() query: Record<string, any>, @User() user: any) {
        const dto = await this.parseQuery(query);
        return this.reportsGatewayService.summaryNationalSourcing(dto, {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
        });
    }

    private async parseQuery(query: Record<string, any>): Promise<NationalSourcingReportGatewayDto> {
        const dto = plainToInstance(NationalSourcingReportGatewayDto, query);

        const errors = await validate(dto, { whitelist: true });
        if (errors.length) {
            throw new BadRequestException(errors.flatMap((e) => Object.values(e.constraints ?? {})));
        }

        if (dto.fechaDesde && dto.fechaHasta && dto.fechaDesde > dto.fechaHasta) {
            throw new BadRequestException('fechaDesde no puede ser mayor que fechaHasta');
        }

        return dto;
    }
}