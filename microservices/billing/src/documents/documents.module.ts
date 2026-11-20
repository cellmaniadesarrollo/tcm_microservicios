import { Module } from '@nestjs/common';
import { DocumentsController } from './controllers/documents.controller';
import { DocumentMapper } from './mappers/document.mapper';
import { SriXmlRenderer } from './renderers/sri-xml/sri-xml.renderer';
import { DocumentsService } from './services/documents.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentMapper, SriXmlRenderer],
  exports: [DocumentsService],
})
export class DocumentsModule {}