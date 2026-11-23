import { Module } from '@nestjs/common';
import { AwsS3Module } from '../aws-s3/aws-s3.module';
import { SignaturesModule } from '../signature/signatures.module';
import { DocumentsController } from './controllers/documents.controller';
import { DocumentMapper } from './mappers/document.mapper';
import { SriXmlRenderer } from './renderers/sri-xml/sri-xml.renderer';
import { DocumentsService } from './services/documents.service';
import { SigningService } from './services/signing.service';

@Module({
  imports: [AwsS3Module, SignaturesModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentMapper, SriXmlRenderer, SigningService],
  exports: [DocumentsService, SigningService],
})
export class DocumentsModule {}