import { Module } from '@nestjs/common';
import { InventoryCoreService } from './inventory-core.service';
import { InventoryCoreController } from './inventory-core.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthModule } from '../common/auth/auth.module';
import { InventoryCoreServiceClient } from '../common/microservices/inventory-core-service-client';
import { SuppliersController } from './suppliers/suppliers.controller';
import { SuppliersService } from './suppliers/suppliers.service';
import { ReceiptsController } from './receipts/receipts.controller';
import { ReceiptsService } from './receipts/receipts.service';
import { SriController } from './sri/sri.controller';
import { SriService } from './sri/sri.service';
import { StockVouchersController } from './stock-vouchers/stock-vouchers.controller';
import { StockVouchersService } from './stock-vouchers/stock-vouchers.service';
import { EmployeesController } from './employees/employees.controller';
import { EmployeesService } from './employees/employees.service';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { LabelsController } from './labels/labels.controller';
import { LabelsService } from './labels/labels.service';

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
  controllers: [InventoryCoreController, SuppliersController, ReceiptsController, SriController, StockVouchersController,
    EmployeesController, OrdersController, LabelsController
  ],
  providers: [InventoryCoreService, InventoryCoreServiceClient, SuppliersService, ReceiptsService, SriService,
    StockVouchersService, EmployeesService, OrdersService, LabelsService],
})
export class InventoryCoreModule { }
