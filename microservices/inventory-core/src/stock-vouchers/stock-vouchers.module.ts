import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { SequencesModule } from '../common/sequences/sequences.module';
import { CompaniesModule } from '../companies/companies.module';
import { StockModule } from '../stock/stock.module';
import { StockMovementReason } from './entities/stock-movement-reason.entity';
import { StockVoucherLineUnit } from './entities/stock-voucher-line-unit.entity';
import { StockVoucherLine } from './entities/stock-voucher-line.entity';
import { StockVoucher } from './entities/stock-voucher.entity';
import { StockVouchersController } from './stock-vouchers.controller';
import { StockVouchersService } from './stock-vouchers.service';
import { StockVoucherAttachment } from './entities/stock-voucher-attachment.entity';
import { AwsS3Module } from '../aws-s3/aws-s3.module';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StockMovementReason, StockVoucher, StockVoucherLine, StockVoucherLineUnit, StockVoucherAttachment,
    ]),
    CompaniesModule,   // MainBranchService
    StockModule,       // StockService
    SequencesModule,
    AuditLogModule,
    AwsS3Module,
    OutboxModule
  ],
  controllers: [StockVouchersController],
  providers: [StockVouchersService],
  exports: [StockVouchersService],
})
export class StockVouchersModule { }