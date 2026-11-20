export class InvoiceLineDto {
  mainCode!: string;
  description!: string;
  quantity!: number;
  unitPrice!: number;      // SIN IVA
  discountId?: string;
  vatRateCode!: string;    // código del catálogo sri_vat_rate
}

export class InvoicePaymentDto {
  methodCode!: string;     // 01, 15, 16, 17, 18, 19, 20, 21
  amount!: number;
  term?: number;
  timeUnit?: string;
}

export class CreateInvoiceDto {
  clientRequestId!: string;
  branchId!: string;
  issueDate!: string;      // YYYY-MM-DD
  orderId?: string;        // opcional, para conectar ventas después

  buyerIdTypeCode!: string;
  buyerIdNumber!: string;
  buyerName!: string;
  buyerAddress?: string;
  buyerEmail?: string;

  lines!: InvoiceLineDto[];
  payments!: InvoicePaymentDto[];
  tip?: number;
}