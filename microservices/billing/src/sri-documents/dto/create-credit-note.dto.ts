export class CreditNoteLineDto {
  sourceLineId!: string;   // id de la línea de la factura
  quantity!: number;       // <= cantidad pendiente de devolver
}

export class CreateCreditNoteDto {
  clientRequestId!: string;
  modifiedDocumentId!: string;
  issueDate!: string;          // YYYY-MM-DD
  reason!: string;             // motivo (obligatorio en el XML)
  lines?: CreditNoteLineDto[]; // si no viene: devolución total de lo pendiente
  returnStock?: boolean;       // devolución física: reingresa stock al autorizarse
}