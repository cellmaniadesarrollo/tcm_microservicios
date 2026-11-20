export type DocKind = 'FACTURA' | 'NOTA_CREDITO';

export interface DocIssuer {
  ruc: string;
  businessName: string;
  tradeName?: string | null;
  headOfficeAddress: string;
  establishmentAddress: string;
  specialTaxpayer?: string | null;
  accountingRequired: boolean;
  withholdingAgent?: string | null;
  rimpe?: 'RIMPE' | 'POPULAR' | null;
}

export interface DocLine {
  mainCode: string;
  auxCode?: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  lineTotal: string;
  additionalDetails?: { name: string; value: string }[];
  vatRateCode: string;
  vatPercentage: string;
  vatBase: string;
  vatAmount: string;
}

export interface BaseDoc {
  environmentCode: string;
  emissionTypeCode: string;
  accessKey: string;
  series: string; // 6 dígitos
  sequence: number | string;
  issueDate: string; // YYYY-MM-DD
  issuer: DocIssuer;
  lines: DocLine[];
  totalWithoutTax: string;
}

export interface InvoiceDoc extends BaseDoc {
  kind: 'FACTURA';
  buyer: {
    idTypeCode: string;
    idNumber: string;
    name: string;
    address?: string | null;
    email?: string | null;
  };
  guideNumber?: string | null; // 001-001-000000001
  totalDiscount: string;
  tip: string;
  total: string;
  payments: { methodCode: string; amount: string; term?: number | null; timeUnit?: string | null }[];
  withheldVat?: string | null; // valorRetIva
  withheldIncomeTax?: string | null; // valorRetRenta
  retentions?: { code: string; percentageCode: string; rate: string; value: string }[];
  additionalInfo?: { name: string; value: string }[];
}

export interface CreditNoteDoc extends BaseDoc {
  kind: 'NOTA_CREDITO';
  buyer: { idTypeCode: string; idNumber: string; name: string; email?: string | null };
  modifiedDocTypeCode: string;
  modifiedDocSeries: string;
  modifiedDocSequence: number | string;
  modifiedDocIssueDate: string;
  reason: string;
  totalModification: string;
}

export type AnyDoc = InvoiceDoc | CreditNoteDoc;