import { Global, Module } from '@nestjs/common';
//import { KafkaProducerService } from './kafka.producer';
import { KafkaConsumerService } from './kafka.consumer';
@Global()
@Module({
    providers: [KafkaConsumerService,],
    exports: [KafkaConsumerService],
})
export class KafkaModule { }
