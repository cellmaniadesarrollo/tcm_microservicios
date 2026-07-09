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
        console.log(`🔧 [${eventType}] Repuesto asignado → order:\n${JSON.stringify(data, null, 2)}`);
        await this.spareAssignmentsService.assignSpare(data);
    }

    // 👇 Reutilizado para el flujo de solicitud de cancelación (antes libre)
    private async handleSpareCancelled(eventType: string, data: any) {
        console.log(`🔄 [${eventType}] Actualización solicitud cancelación → movement: ${data?.movement_id} | status: ${data?.assignment_status}`);
        await this.spareAssignmentsService.handleCancellationStatusUpdate(data);
    }

    // 👇 Intacto — solo retornos directos de bodega
    private async handleSpareReturned(eventType: string, data: any) {
        console.log(`↩️ [${eventType}] Repuesto devuelto → movementId:\n${JSON.stringify(data, null, 2)}`);
        await this.spareAssignmentsService.returnSpare(data);
    }

}