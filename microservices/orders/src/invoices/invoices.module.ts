//microservices\orders\src\invoices\invoices.module.ts
import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { BroadcastModule } from '../broadcast/broadcast.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderExtraService } from '../order-extras/entities/order-extra-service.entity';
import { OrderFinding } from '../order-findings/entities/order-finding.entity';
import { OrderInvoice } from './entities/order-invoice.entity';

@Module({

  imports: [BroadcastModule, TypeOrmModule.forFeature([OrderExtraService, OrderFinding, OrderInvoice])],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService]
})
export class InvoicesModule { }
