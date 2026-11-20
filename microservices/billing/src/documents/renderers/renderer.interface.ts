import { AnyDoc, DocKind } from '../models/document.model';

export type RenderFormat = 'SRI_XML' | 'PDF';

export interface DocumentRenderer<TOut = string | Buffer> {
  readonly format: RenderFormat;
  supports(kind: DocKind): boolean;
  render(doc: AnyDoc): Promise<TOut> | TOut;
}