import { Module, Global } from '@nestjs/common';
import { KafkaProducerService } from './kafka.producer';
import { KafkaConsumerService } from './kafka.consumer';

@Global()   // ← Esto permite usarlo en cualquier módulo sin importarlo
@Module({
    providers: [KafkaProducerService, KafkaConsumerService],
    exports: [KafkaProducerService, KafkaConsumerService],
})
export class KafkaModule { }