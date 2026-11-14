import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ProductReplica } from './entities/product-replica.entity';
import { ProductsReplicaService } from './products-replica.service';
import { ProductsSyncService } from './products-sync.service';
import { ProductsEventsListener } from './products-events.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductReplica]),
    ClientsModule.register([
      {
        name: 'INVENTORY_SYNC',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
          queue: 'inventory_core_queue_sync',
          queueOptions: { durable: true },
          persistent: true,
        },
      },
    ]),
  ],
  providers: [ProductsReplicaService, ProductsSyncService, ProductsEventsListener],
  exports: [ProductsEventsListener, ProductsReplicaService],
})
export class ProductsReplicaModule { }