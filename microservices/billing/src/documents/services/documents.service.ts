import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentMapper } from '../mappers/document.mapper';
import { AnyDoc } from '../models/document.model';
import { DocumentRenderer, RenderFormat } from '../renderers/renderer.interface';
import { SriXmlRenderer } from '../renderers/sri-xml/sri-xml.renderer';

@Injectable()
export class DocumentsService {
  private readonly renderers: DocumentRenderer[];

  constructor(
    private readonly mapper: DocumentMapper,
    sriXml: SriXmlRenderer,
    // pdf: RidePdfRenderer,  ← cuando exista, se agrega aquí
  ) {
    this.renderers = [sriXml];
  }

  async render(companyId: string, documentId: string, format: RenderFormat) {
    const doc = await this.mapper.load(companyId, documentId);
    return this.renderDoc(doc, format);
  }

  /** Para quien ya tiene el modelo en mano (por ejemplo, el firmador). */
  renderDoc(doc: AnyDoc, format: RenderFormat) {
    const renderer = this.renderers.find((r) => r.format === format && r.supports(doc.kind));
    if (!renderer) throw new NotFoundException(`No hay renderer ${format} para ${doc.kind}`);
    return renderer.render(doc);
  }
}