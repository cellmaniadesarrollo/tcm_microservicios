import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { REALTIME_CLIENT } from '../broadcast.constants';

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(@Inject(REALTIME_CLIENT) private readonly client: ClientProxy) {}

  publishInvoiceUpdated(payload: Record<string, any>) {
    this.emit('invoice.updated', payload);
  }

  publishReceiptUpdated(payload: Record<string, any>) {
    this.emit('receipt.updated', payload);
  }

  /** Nunca lanza: un fallo de realtime no debe romper la facturación. */
  private emit(pattern: string, payload: Record<string, any>) {
    try {
      this.client.emit(pattern, payload).subscribe({
        error: (e) => this.logger.warn(`${pattern} falló: ${e?.message}`),
      });
    } catch (e: any) {
      this.logger.warn(`${pattern} falló: ${e?.message}`);
    }
  }
}