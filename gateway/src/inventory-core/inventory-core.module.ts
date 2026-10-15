import { Module } from '@nestjs/common';
import { InventoryCoreService } from './inventory-core.service';
import { InventoryCoreController } from './inventory-core.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthModule } from '../common/auth/auth.module';
import { InventoryCoreServiceClient } from '../common/microservices/inventory-core-service-client';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'INVENTORY_CORE_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://rabbitmq:5672'],
          queue: 'inventory_core_queue', // Cola dedicada a inventario-core
          queueOptions: { durable: false },
        },
      },
    ]),
    AuthModule,
  ],
  controllers: [InventoryCoreController],
  providers: [InventoryCoreService, InventoryCoreServiceClient,],
})
export class InventoryCoreModule { }
