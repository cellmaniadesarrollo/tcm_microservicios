// gateway/src/orders/part-request-reports-gateway.service.ts

import { Injectable } from '@nestjs/common';
import { OrderServiceClient } from '../../common/microservices/order-service-client';
import { NationalSourcingReportGatewayDto } from './dto/national-sourcing-report-gateway.dto';

@Injectable()
export class PartRequestReportsGatewayService {
    constructor(private readonly orderServiceClient: OrderServiceClient) { }

    async listNationalSourcing(dto: NationalSourcingReportGatewayDto, user: any) {
        return this.orderServiceClient.send('report_national_sourcing', { dto, user });
    }

    async summaryNationalSourcing(dto: NationalSourcingReportGatewayDto, user: any) {
        return this.orderServiceClient.send('report_national_sourcing_summary', { dto, user });
    }
}