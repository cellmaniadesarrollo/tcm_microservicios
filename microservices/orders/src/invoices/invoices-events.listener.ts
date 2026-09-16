// microservices/orders/src/invoices/invoices-events.listener.ts
import { Injectable } from '@nestjs/common';
import { KafkaConsumerService } from '../kafka/kafka.consumer';
import { InvoicesService } from './invoices.service';
import { InvoiceIssuedEventDto, InvoiceFailedEventDto } from './dto/invoice-status-event.dto';

const TOPICS = {
    INVOICE_STATUS_UPDATED: 'ms.billing.invoice.status.updated',
} as const;

@Injectable()
export class InvoicesEventsListener {   // ← sin OnModuleInit, igual que UsersEventsListener
    constructor(
        private readonly invoicesService: InvoicesService,
        private readonly kafkaConsumer: KafkaConsumerService,
    ) { }

    registerHandlers() {
        this.kafkaConsumer.registerHandler(
            TOPICS.INVOICE_STATUS_UPDATED,
            (eventType, data) => this.handleInvoiceStatusUpdated(eventType, data),
        );
    }

    private async handleInvoiceStatusUpdated(eventType: string, data: any) {
        // billing-topics.js define eventType 'INVOICE_ISSUED' | 'INVOICE_FAILED'
        // dentro del mismo topic ms.billing.invoice.status.updated
        if (eventType === 'INVOICE_ISSUED') {
            console.log(`🔵 [${eventType}] Factura confirmada para orden ${data?.order_id}`);
            await this.invoicesService.confirmEmission(data as InvoiceIssuedEventDto);
            return;
        }

        if (eventType === 'INVOICE_FAILED') {
            console.log(`🔴 [${eventType}] Emisión fallida para orden ${data?.order_id}`);
            const failed = data as InvoiceFailedEventDto;
            await this.invoicesService.failEmission(failed.order_id, failed.message);
            return;
        }

        console.warn(`⚠️ [InvoicesEventsListener] eventType desconocido: ${eventType}`);
    }
}