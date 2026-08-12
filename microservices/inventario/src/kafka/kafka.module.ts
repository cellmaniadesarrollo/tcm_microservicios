import { Module, Global } from '@nestjs/common';
import { KafkaConsumer } from './kafka.consumer';
import { KafkaListenersOrchestrator } from './kafka-listeners.orchestrator';
import { ProductsModule } from '../products/products.module'; // ✅ AGREGAR ESTA LÍNEA

@Global()
@Module({
  imports: [ProductsModule], // ✅ AGREGAR ESTA LÍNEA
  providers: [KafkaConsumer, KafkaListenersOrchestrator],
  exports: [KafkaConsumer, KafkaListenersOrchestrator],
})
export class KafkaModule {}