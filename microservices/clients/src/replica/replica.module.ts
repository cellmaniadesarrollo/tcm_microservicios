import { Global, Module } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { ReplicaPublisherService } from './replica-publisher.service';
import { ReplicaSyncController } from './replica-sync.controller';

@Global()
@Module({
  imports: [KafkaModule],
  providers: [ReplicaPublisherService],
  controllers: [ReplicaSyncController],
  exports: [ReplicaPublisherService],
})
export class ReplicaModule { }