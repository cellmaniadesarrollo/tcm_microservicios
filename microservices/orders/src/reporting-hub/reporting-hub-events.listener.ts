// src/reporting-hub-events/reporting-hub-events.listener.ts
import { Injectable } from '@nestjs/common';
import { KafkaConsumerService } from '../kafka/kafka.consumer';  
import { ReportingHubService } from './reporting-hub.service';

const TOPICS = {
    VALIDATION_CREATED: 'ms.reporting.validation.created',
    VALIDATION_UPDATED: 'ms.reporting.validation.updated',
} as const;

@Injectable()
export class ReportingHubEventsListener {
    constructor(
        private readonly eventsService: ReportingHubService,
        private readonly kafkaConsumer: KafkaConsumerService,
    ) { }

    registerHandlers() {
        this.kafkaConsumer.registerHandler(
            TOPICS.VALIDATION_CREATED,
            (eventType, data) => this.handleValidationCreated(eventType, data),
        );

        this.kafkaConsumer.registerHandler(
            TOPICS.VALIDATION_UPDATED,
            (eventType, data) => this.handleValidationUpdated(eventType, data),
        );

        console.log('📡 Handlers de ReportingHub registrados');
    }

    private async handleValidationCreated(eventType: string, data: any) {
        console.log(`🟢 [${eventType}] Validación creada para orden ${data?.order_id}`);
        await this.eventsService.syncValidation({
            order_id: data.order_id,
            is_checked: false,          // recién creada siempre viene en false
        });
    }

    private async handleValidationUpdated(eventType: string, data: any) {
        console.log(`🔵 [${eventType}] Validación actualizada para orden ${data?.order_id} | checked=${data?.is_checked}`);
        await this.eventsService.syncValidation({
            order_id: data.order_id,
            is_checked: data.is_checked,
        });
    }
}