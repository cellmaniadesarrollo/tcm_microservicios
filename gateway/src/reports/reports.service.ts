import { Body, Inject, Injectable, Param, Patch } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { GetOrdersFilterDto } from './dto/get-orders-filter.dto.gateway';
import { GetAdminDashboardRangeDto } from './dto/get-admin-dashboard.dto.gateway';

@Injectable()
export class ReportsService {
    constructor(
        @Inject('REPORT_SERVICE') private readonly client: ClientProxy,
    ) { }

    async getOrderFilters(user: any) {
        // La lógica de "mensajería" se queda aquí
        return await firstValueFrom(
            this.client.send(
                { cmd: 'get_order_filters_metadata' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    user,
                },
            ),
        );
    }
    async getOrdersList(user: any, filterDto: GetOrdersFilterDto) {

        return await firstValueFrom(
            this.client.send(
                { cmd: 'get_order_list_metadata' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    data: filterDto,
                    user,
                },
            ),
        );
    }
    async getDashboardCustomer(user: any) {
        // La lógica de "mensajería" se queda aquí
        return await firstValueFrom(
            this.client.send(
                { cmd: 'fetch_customer_for_dashboard_orders' },
                {
                    internalToken: process.env.INTERNAL_SECRET, // El service gestiona el token 
                    user,
                },
            ),
        );
    }
    async getOrderDetail(user: any, orderId: number) {
        return await firstValueFrom(
            this.client.send(
                { cmd: 'get_order_detail' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    user,
                    orderId,
                },
            ),
        );
    }
    async getDashboard(user: any): Promise<any> {
        return firstValueFrom(
            this.client.send(
                { cmd: 'get_dashboard' },
                { internalToken: process.env.INTERNAL_SECRET, user },
            ),
        );
    }
    async getDashboardDrill(user: any, card: string, page: number, limit: number) {
        return await firstValueFrom(
            this.client.send(
                { cmd: 'get_dashboard_drill' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    user,
                    card,
                    page,
                    limit,
                },
            ),
        );
    }


    async toggleOrderValidation(validationId: string, isChecked: boolean, user: any) {
        return await firstValueFrom(
            this.client.send(
                { cmd: 'toggle_order_validation' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    validationId,
                    isChecked,
                    user,
                },
            ),
        );
    }
    async getAdminDashboardRange(user: any, dto: GetAdminDashboardRangeDto) {
        return await firstValueFrom(
            this.client.send(
                { cmd: 'get_admin_dashboard_range' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    user: {
                        userId: user.sub,
                        companyId: user.companyId,
                    },
                    from: dto.from,
                    to: dto.to,
                },
            ),
        );
    }
}