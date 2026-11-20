import { Injectable } from '@nestjs/common';
import { AnyDoc, DocKind } from '../../models/document.model';
import { DocumentRenderer } from '../renderer.interface';
import { buildCreditNoteXml } from './xml/credit-note.xml';
import { buildInvoiceXml } from './xml/invoice.xml';

@Injectable()
export class SriXmlRenderer implements DocumentRenderer<string> {
  readonly format = 'SRI_XML' as const;

  supports(kind: DocKind) {
    return kind === 'FACTURA' || kind === 'NOTA_CREDITO';
  }

  render(doc: AnyDoc): string {
    switch (doc.kind) {
      case 'FACTURA':
        return buildInvoiceXml(doc);
      case 'NOTA_CREDITO':
        return buildCreditNoteXml(doc);
    }
  }
}