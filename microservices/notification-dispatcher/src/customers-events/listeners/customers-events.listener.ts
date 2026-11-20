import { Injectable, Logger } from '@nestjs/common';
import { KafkaConsumerService } from '../../kafka/kafka.consumer';
import { CustomersCacheService } from '../services/customers-cache.service';
import { BillingCacheService } from '../services/billing-cache.service';

const TOPICS = {
    CUSTOMER_UPSERTED: 'ms.client.customer.upserted',
    BILLING_UPSERTED: 'ms.client.billing.upserted',
} as const;

@Injectable()
export class CustomersEventsListener {
    private readonly logger = new Logger(CustomersEventsListener.name);

    constructor(
        private readonly customers: CustomersCacheService,
        private readonly billing: BillingCacheService,
        private readonly kafkaConsumer: KafkaConsumerService,
    ) { }

    registerHandlers() {
        this.kafkaConsumer.registerHandler(TOPICS.CUSTOMER_UPSERTED, async (eventType, data) => {
            this.logger.log(`👤 [${eventType}] Cliente ${data?.id}`);
            await this.customers.upsertMany([data]);
        });
        this.kafkaConsumer.registerHandler(TOPICS.BILLING_UPSERTED, async (eventType, data) => {
            this.logger.log(`🧾 [${eventType}] Billing ${data?.id}`);
            await this.billing.upsertMany([data]);
        });
        this.logger.log('📡 Handlers de Customers/Billing registrados');
    }
}