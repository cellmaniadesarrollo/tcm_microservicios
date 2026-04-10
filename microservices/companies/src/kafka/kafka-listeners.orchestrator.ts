import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerService } from './kafka.consumer';
import { UsersEventsListener } from '../users/users-events.listener';

@Injectable()
export class KafkaListenersOrchestrator implements OnModuleInit {
    constructor(
        private readonly kafkaConsumer: KafkaConsumerService,
        private readonly usersListener: UsersEventsListener,
    ) { }

    async onModuleInit() {
        this.usersListener.registerHandlers();

        // 2. Un solo start() con todos los topics listos y suscritos
        await this.kafkaConsumer.start();

        console.log('✅ Kafka — todos los listeners activos (  Users )');
    }
}