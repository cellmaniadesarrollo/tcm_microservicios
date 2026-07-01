import { Injectable } from '@nestjs/common';
import { KafkaConsumerService } from '../kafka/kafka.consumer';
import { SpareAssignmentsService } from './spare-assignments.service';

const TOPICS = {
    SPARE_ASSIGNED: 'ms.inventory.spare.assigned',
    SPARE_CANCELLED: 'ms.inventory.spare.cancelled',
    SPARE_RETURNED: 'ms.inventory.spare.returned',
} as const;

@Injectable()
export class SpareAssignmentsEventsListener {

    constructor(
        private readonly spareAssignmentsService: SpareAssignmentsService,
        private readonly kafkaConsumer: KafkaConsumerService,
    ) { }

    registerHandlers() {
        this.kafkaConsumer.registerHandler(
            TOPICS.SPARE_ASSIGNED,
            (eventType, data) => this.handleSpareAssigned(eventType, data),
        );
        this.kafkaConsumer.registerHandler(
            TOPICS.SPARE_CANCELLED,
            (eventType, data) => this.handleSpareCancelled(eventType, data),
        );
        this.kafkaConsumer.registerHandler(
            TOPICS.SPARE_RETURNED,
            (eventType, data) => this.handleSpareReturned(eventType, data),
        );
    }
    private async handleSpareAssigned(eventType: string, data: any) {
        console.log(`🔧 [${eventType}] Repuesto asignado → order: ${data?.orderId}`);
        await this.spareAssignmentsService.assignSpare(data);
    }

    private async handleSpareCancelled(eventType: string, data: any) {
        console.log(`🚫 [${eventType}] Repuesto cancelado → movementId: ${data?.movementId}`);
        await this.spareAssignmentsService.cancelSpare(data);
    }

    private async handleSpareReturned(eventType: string, data: any) {
        console.log(`↩️ [${eventType}] Repuesto devuelto → movementId: ${data?.movementId} | total: ${data?.isTotal}`);
        await this.spareAssignmentsService.returnSpare(data);
    }
} 