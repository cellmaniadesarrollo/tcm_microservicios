import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { GetOrdersFilterDto } from './dto/get-orders-filter.dto.gateway';

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

}