// task-board/src/kafka/kafka.module.ts
import { Global, Module } from '@nestjs/common';
import { KafkaConsumerService } from './kafka.consumer';
import { KafkaProducerService } from './kafka.producer'; // 👈 Importar

@Global()
@Module({
  providers: [
    KafkaConsumerService,
    KafkaProducerService, // 👈 Agregar
  ],
  exports: [
    KafkaConsumerService,
    KafkaProducerService, // 👈 Exportar
  ],
})
export class KafkaModule {}