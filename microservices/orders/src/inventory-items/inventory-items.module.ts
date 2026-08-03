// microservices/orders/src/inventory-items/inventory-items.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { InventoryItemReplica } from './entities/inventory-item-replica.entity';
import { InventoryItemsService } from './inventory-items.service';
import { InventoryItemsController } from './inventory-items.controller';
//import { InventoryItemsListener } from './inventory-items.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryItemReplica]),
    ClientsModule.register([
      {
        name: 'INVENTORY_ASYNC',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
          queue: 'inventory_queue_sync',
          queueOptions: { durable: true },
          persistent: true,
        },
      },
    ]),
  ],
  controllers: [InventoryItemsController],
  providers: [InventoryItemsService,],
  exports: [TypeOrmModule.forFeature([InventoryItemReplica])],
})
export class InventoryItemsModule { } 