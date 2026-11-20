import { Controller, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InternalAuthInterceptor } from '../../interceptors/internal-auth.interceptor';
import { DocumentsService } from '../services/documents.service';

@Controller()
@UseInterceptors(InternalAuthInterceptor)
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @MessagePattern({ cmd: 'preview_document_xml' })
  async previewXml(@Payload() d: any) {
    const xml = await this.service.render(d.user.companyId, d.documentId, 'SRI_XML');
    return { xml };
  }
}