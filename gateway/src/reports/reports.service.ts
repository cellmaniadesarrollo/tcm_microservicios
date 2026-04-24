import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ReportsService {
    constructor(
        @Inject('REPORT_SERVICE') private readonly client: ClientProxy,
    ) { }

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