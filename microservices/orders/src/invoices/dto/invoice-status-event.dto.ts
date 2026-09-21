// microservices/orders/src/invoices/dto/invoice-status-event.dto.ts
export interface InvoiceIssuedEventDto {
    order_id: number;
    invoice_id: string;
    invoice_number: string;
    status: 'success' | 'pending' | 'rejected';
    issue_date?: string;
    subtotal?: number;
    total?: number;
    clave_acceso?: string;
    code_establecimiento?: string;
    code_punto_emision?: string;
    payment_code?: string;
    sri_response?: string;
    already_existed?: boolean;
}

export interface InvoiceFailedEventDto {
    order_id: number;
    message: string;
}