import { Injectable } from '@nestjs/common';
import { KafkaConsumerService } from '../../kafka/kafka.consumer';
import { CustomersReplicaService } from '../services/customers-replica.service';
import { BillingReplicaService } from '../services/billing-replica.service';

const TOPICS = {
    CUSTOMER_UPSERTED: 'ms.client.customer.upserted',
    BILLING_UPSERTED: 'ms.client.billing.upserted',
} as const;

@Injectable()
export class ClientsEventsListener {
    constructor(
        private readonly customers: CustomersReplicaService,
        private readonly billing: BillingReplicaService,
        private readonly kafkaConsumer: KafkaConsumerService,
    ) { }

    registerHandlers() {
        this.kafkaConsumer.registerHandler(TOPICS.CUSTOMER_UPSERTED, async (eventType, data) => {
            console.log(`👤 [${eventType}] Cliente ${data?.id}`);
            await this.customers.upsertMany([data]);
        });
        this.kafkaConsumer.registerHandler(TOPICS.BILLING_UPSERTED, async (eventType, data) => {
            console.log(`🧾 [${eventType}] Billing ${data?.id}`);
            await this.billing.upsertMany([data]);
        });
    }
} 