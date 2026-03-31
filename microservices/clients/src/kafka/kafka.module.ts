import { Module, Global } from '@nestjs/common';
import { KafkaProducerService } from './kafka.producer';

@Global()   // ← Esto permite usarlo en cualquier módulo sin importarlo
@Module({
    providers: [KafkaProducerService],
    exports: [KafkaProducerService],
})
export class KafkaModule { }