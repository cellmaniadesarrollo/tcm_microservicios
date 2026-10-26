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

@Module({
  imports: [TypeOrmModule.forFeature([ReceiptDocumentType, Receipt, ReceiptLine, ReceiptLineSerial]),
    StockModule, CompaniesModule, AuditLogModule, SequencesModule],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
})
export class ReceiptsModule { }
