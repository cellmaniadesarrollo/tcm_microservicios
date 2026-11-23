import { Controller, Logger, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InternalAuthInterceptor } from '../../interceptors/internal-auth.interceptor';
import { DocumentsService } from '../services/documents.service';
import { SigningService } from '../services/signing.service';
import { SriSubmissionService } from '../services/sri-submission.service';

@Controller()
@UseInterceptors(InternalAuthInterceptor)
export class DocumentsController {
  private readonly log = new Logger(DocumentsController.name);

  constructor(
    private readonly service: DocumentsService,
    private readonly signing: SigningService,
    private readonly submission: SriSubmissionService,
  ) {}

  @MessagePattern({ cmd: 'preview_document_xml' })
  async previewXml(@Payload() d: any) {
    this.log.log(`Generando XML del documento ${d.documentId}`);
    try {
      const xml = (await this.service.render(d.user.companyId, d.documentId, 'SRI_XML')) as string;
      this.log.log(`XML generado (${xml.length} caracteres)`);
      return { xml };
    } catch (e: any) {
      this.log.error(`Falló la generación del XML: ${e?.message}`, e?.stack);
      throw e;
    }
  }

  @MessagePattern({ cmd: 'sign_document' })
  async sign(@Payload() d: any) {
    this.log.log(`Firmando documento ${d.documentId}`);
    try {
      return await this.signing.signDocument(d.user.companyId, d.documentId);
    } catch (e: any) {
      this.log.error(`Falló la firma: ${e?.message}`, e?.stack);
      throw e;
    }
  }

  @MessagePattern({ cmd: 'send_document' })
  async send(@Payload() d: any) {
    this.log.log(`Enviando documento ${d.documentId} al SRI`);
    try {
      return await this.submission.send(d.user.companyId, d.documentId);
    } catch (e: any) {
      this.log.error(`Falló el envío al SRI: ${e?.message}`, e?.stack);
      throw e;
    }
  }
}