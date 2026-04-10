import { Global, Module } from '@nestjs/common';
import { KafkaConsumerService } from './kafka.consumer';
import { KafkaProducerService } from './kafka.producer';

@Global()
@Module({
    providers: [KafkaConsumerService, KafkaProducerService,],
    exports: [KafkaConsumerService, KafkaProducerService,],
})
export class KafkaModule { }