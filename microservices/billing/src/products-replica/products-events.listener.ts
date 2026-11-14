import { Injectable } from '@nestjs/common';
import { KafkaConsumerService } from '../kafka/kafka.consumer';
import { ProductsReplicaService } from './products-replica.service';

const TOPICS = {
    PRODUCT_UPSERTED: 'ms.inventory.core.product.upserted',
} as const;

@Injectable()
export class ProductsEventsListener {
    constructor(
        private readonly replica: ProductsReplicaService,
        private readonly kafkaConsumer: KafkaConsumerService,
    ) { }

    registerHandlers() {
        this.kafkaConsumer.registerHandler(
            TOPICS.PRODUCT_UPSERTED,
            (eventType, data) => this.handleUpserted(eventType, data),
        );
    }

    private async handleUpserted(eventType: string, data: any) {
        console.log(`📦 [${eventType}] Producto: ${data?.id} (${data?.sku})`);
        // Si lanza, el consumer reintenta 3 veces y luego manda a la DLQ; el cron diario lo recupera
        await this.replica.upsertMany([data]);
    }
}