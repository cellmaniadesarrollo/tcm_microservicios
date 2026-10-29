import { Module } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { ReceiptsController } from './receipts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReceiptDocumentType } from '../catalogs/entities/receipt-document-type.entity';
import { Receipt } from './entities/receipt.entity';
import { ReceiptLine } from './entities/receipt-line.entity';
import { ReceiptLineSerial } from './entities/receipt-line-serial.entity';
import { StockModule } from '../stock/stock.module';
import { CompaniesModule } from '../companies/companies.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { SequencesModule } from '../common/sequences/sequences.module';
import { CompanySequence } from '../common/sequences/entities/company-sequence.entity';
import { StockUnitSerial } from '../stock/entities/stock-unit-serial.entity';
import { AwsS3Module } from '../aws-s3/aws-s3.module';
import { ReceiptAttachment } from './entities/receipt-attachment.entity';
import { ReceiptPayment } from './entities/receipt-payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ReceiptDocumentType, Receipt,
    ReceiptLine, ReceiptLineSerial,
    CompanySequence,
    Receipt,
    ReceiptLine,
    StockUnitSerial, ReceiptAttachment, ReceiptPayment]),
    StockModule, CompaniesModule, AuditLogModule, SequencesModule, AwsS3Module],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
})
export class ReceiptsModule { }
