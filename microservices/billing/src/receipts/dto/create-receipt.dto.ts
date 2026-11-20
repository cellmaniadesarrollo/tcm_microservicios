export interface CreateReceiptDto {
  clientRequestId: string;
  branchId: string;
  issueDate: string;
  buyerIdNumber?: string;
  buyerName?: string;
  paymentMethod: string;
  total: number;
  lines: {
    productId?: string;
    lotId?: string;
    unitId?: string;
    mainCode: string;
    batch?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discountId?: string; // del catálogo; el monto lo calcula el servidor
  }[];
}