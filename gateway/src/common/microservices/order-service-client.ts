import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class OrderServiceClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject('ORDER_SERVICE') private readonly client: ClientProxy) {}

  async onModuleInit() {
    await this.client.connect();
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