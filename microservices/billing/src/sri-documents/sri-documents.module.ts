import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssuersModule } from '../issuer/issuers.module';
import { SriVatRate } from '../sri-catalogs/entities/sri-vat-rate.entity';
import { SriDocument } from './entities/sri-document.entity';
import { SriDocumentLine } from './entities/sri-document-line.entity';
import { SriDocumentPayment } from './entities/sri-document-payment.entity';
import { SriSequence } from './entities/sri-sequence.entity';
import { SriDocumentsService } from './services/sri-documents.service';
import { SriSequenceService } from './services/sri-sequence.service';
import { SriDocumentsController } from './controllers/sri-documents.controller';
import { SriPaymentMethod } from '../sri-catalogs/entities/sri-payment-method.entity';
import { DiscountsModule } from '../discounts/discounts.module';
import { DocumentsModule } from '../documents/documents.module';
import { AwsS3Module } from '../aws-s3/aws-s3.module';
import { SigningService } from '../documents/services/signing.service';
import { BroadcastModule } from '../broadcast/broadcast.module';
import { CreditNotesService } from './services/credit-notes.service';
import { SriEmissionService } from './services/sri-emission.service';
import { VatRatesService } from './services/vat-rates.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SriDocument,
      SriDocumentLine,
      SriDocumentPayment,
      SriSequence,
      SriVatRate,
      SriPaymentMethod,
    ]),
    IssuersModule,
    DiscountsModule,
    DocumentsModule,
    AwsS3Module,
    BroadcastModule,
  ],
  controllers: [SriDocumentsController],
  providers: [
    SriSequenceService, 
    SriDocumentsService, 
    CreditNotesService,
    SriEmissionService,
    VatRatesService,
  ],
  exports: [SriDocumentsService],
})
export class SriDocumentsModule {}