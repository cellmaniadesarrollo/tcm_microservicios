import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { LotReplica } from './entities/lot-replica.entity';
import { LotsReplicaService } from './services/lots-replica.service';
import { LotsSyncService } from './services/lots-sync.service';
import { LotsEventsListener } from './listeners/lots-events.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([LotReplica]),
    ClientsModule.register([{
      name: 'INVENTORY_SYNC',
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
        queue: 'inventory_core_queue_sync',
        queueOptions: { durable: true },
        persistent: true,
      },
    }]),
  ],
  providers: [LotsReplicaService, LotsSyncService, LotsEventsListener],
  exports: [LotsEventsListener, LotsReplicaService,],
})
export class LotsReplicaModule { }