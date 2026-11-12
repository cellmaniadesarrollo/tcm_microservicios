import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AwsS3Module } from '../aws-s3/aws-s3.module';
import { PurchaseLead } from './entities/purchase-leal.entity';
import { PurchaseLeadPhoto } from './entities/purchase-lead-photo.entity';
import { PurchaseLeadService } from './purchase-lead.service';
import { PurchaseLeadController } from './purchase-lead.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseLead, PurchaseLeadPhoto]),
    AwsS3Module,
  ],
  controllers: [PurchaseLeadController],
  providers: [PurchaseLeadService],
  exports: [PurchaseLeadService],
})
export class PurchaseLeadModule {}