import { Injectable } from '@nestjs/common';
import { KafkaConsumerService } from '../../kafka/kafka.consumer';
import { SPARE_EVENTS, SPARE_TOPICS } from '../../outbox/constants/outbox-topics';
import { SpareCancellationsService } from '../services/spare-cancellations.service';

@Injectable()
export class SpareCancellationsEventsListener {
    constructor(
        private readonly service: SpareCancellationsService,
        private readonly kafkaConsumer: KafkaConsumerService,
    ) { }

    registerHandlers() {
        this.kafkaConsumer.registerHandler(
            SPARE_TOPICS.CANCELLATION_REQUESTED,
            async (eventType, data) => {
                if (eventType !== SPARE_EVENTS.CANCELLATION_REQUESTED) return;
                await this.service.handleRequested(data);
            },
        );
    }
}