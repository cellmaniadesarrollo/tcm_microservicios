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

// 👇 NUEVO
export interface SaleConfirmedBatchItemDto {
    batch_id: string;
    batch_number?: number | null;
    order_public_id: string | null;
    is_complete_device: boolean;
    product_id?: string | null;
    service_id?: string | null;
    sku?: string | null;
    product_name?: string | null;
    quantity: number;
    unit_price: number;
    discount: number;
    subtotal: number;
    total: number;
}

export interface SaleConfirmedEventDto {
    order_id: number | null;
    order_public_id: string | null;
    invoice_id: string;
    invoice_number: string;
    order_public_ids: string[];
    code_establecimiento?: string | null;
    code_punto_emision?: string | null;
    items: SaleConfirmedBatchItemDto[];
}