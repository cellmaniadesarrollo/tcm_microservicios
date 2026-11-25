import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchReplica } from '../companies/entities/branch-replica.entity';
import { ReceiptsController } from './controllers/receipts.controller';
import { ReceiptLine } from './entities/receipt-line.entity';
import { ReceiptSequence } from './entities/receipt-sequence.entity';
import { Receipt } from './entities/receipt.entity';
import { ReceiptSequenceService } from './services/receipt-sequence.service';
import { ReceiptsService } from './services/receipts.service';
import { DiscountsModule } from '../discounts/discounts.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Receipt, ReceiptLine, ReceiptSequence, BranchReplica]),
    DiscountsModule,
    DocumentsModule,
  ],
  controllers: [ReceiptsController],
  providers: [ReceiptSequenceService, ReceiptsService],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}