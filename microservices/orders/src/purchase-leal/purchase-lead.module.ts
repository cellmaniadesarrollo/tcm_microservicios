import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseLead } from './entities/purchase-leal.entity';
import { PurchaseLeadService } from './purchase-lead.service';
import { PurchaseLeadController } from './purchase-lead.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PurchaseLead])],
  controllers: [PurchaseLeadController],
  providers: [PurchaseLeadService],
  exports: [PurchaseLeadService],
})
export class PurchaseLeadModule {}