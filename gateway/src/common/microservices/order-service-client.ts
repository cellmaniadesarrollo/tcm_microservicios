// gateway/src/common/microservices/order-service-client.ts
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OrderServiceClient {
    constructor(@Inject('ORDER_SERVICE') private readonly client: ClientProxy) { }

    send<T = any>(cmd: string, payload: Record<string, any> = {}): Promise<T> {
        return firstValueFrom(
            this.client.send<T>(
                { cmd },
                { internalToken: process.env.INTERNAL_SECRET, ...payload },
            ),
        );
    }
}