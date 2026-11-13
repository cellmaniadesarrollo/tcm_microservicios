import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class BillingServiceClient implements OnModuleInit, OnModuleDestroy {
    constructor(@Inject('BILLING_SERVICE') private readonly client: ClientProxy) { }

    async onModuleInit() {
        try {
            await this.client.connect();
        } catch (e: any) {
            console.error('BILLING_SERVICE no disponible al arrancar:', e?.message);
        }
    }

    async onModuleDestroy() {
        await this.client.close();
    }

    send<T = any>(cmd: string, payload: Record<string, any> = {}, ms = 10000): Promise<T> {
        return firstValueFrom(
            this.client
                .send<T>({ cmd }, { internalToken: process.env.INTERNAL_SECRET, ...payload })
                .pipe(timeout(ms)),
        );
    }
}