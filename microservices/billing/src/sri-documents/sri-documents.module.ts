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

@Module({
  imports: [
    TypeOrmModule.forFeature([SriDocument, SriDocumentLine, SriDocumentPayment, SriSequence, SriVatRate]),
    IssuersModule, SriPaymentMethod
  ],
  controllers: [SriDocumentsController],
  providers: [SriSequenceService, SriDocumentsService],
  exports: [SriDocumentsService],
})
export class SriDocumentsModule {}