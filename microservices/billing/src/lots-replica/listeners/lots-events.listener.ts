import { Injectable } from '@nestjs/common';
import { LotsReplicaService } from '../services/lots-replica.service';
import { KafkaConsumerService } from '../../kafka/kafka.consumer';


const TOPICS = { LOT_UPSERTED: 'ms.inventory.core.lot.upserted' } as const;

@Injectable()
export class LotsEventsListener {

    constructor(
        private readonly replica: LotsReplicaService,
        private readonly kafkaConsumer: KafkaConsumerService,
    ) { }

    registerHandlers() {
        this.kafkaConsumer.registerHandler(TOPICS.LOT_UPSERTED, (eventType, data) => this.handle(eventType, data));
    }

    private async handle(eventType: string, data: any) {
        console.log(`🏷️ [${eventType}] Lote #${data?.code} (${data?.id})`);
        await this.replica.upsertMany([data]);
    }
}
