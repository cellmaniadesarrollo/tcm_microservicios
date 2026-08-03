//microservices\companies\src\kafka\kafka.module.ts
import { Global, Module } from '@nestjs/common';
import { KafkaProducerService } from './kafka.producer';
import { KafkaConsumerService } from './kafka.consumer';

@Global()
@Module({
    providers: [KafkaProducerService, KafkaConsumerService],
    exports: [KafkaProducerService, KafkaConsumerService],
})
export class KafkaModule { }