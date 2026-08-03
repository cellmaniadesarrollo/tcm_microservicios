import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaConsumerService } from './kafka.consumer';
import { BoardsEventsListener } from '../boards/boards-events.listener';

@Injectable()
export class KafkaListenersOrchestrator implements OnModuleInit {
    constructor(
        private readonly kafkaConsumer: KafkaConsumerService,
        private readonly boardsListener: BoardsEventsListener,
    ) { }

    async onModuleInit() {
        try { 
            this.boardsListener.registerHandlers(); 
        } catch (e) { 
            console.error('❌ Boards handler error:', e); 
        }

        await this.kafkaConsumer.start();
    }
}