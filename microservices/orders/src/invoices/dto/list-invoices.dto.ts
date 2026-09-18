// microservices/orders/src/invoices/dto/list-invoices.dto.ts
import { InvoiceEmissionStatus } from '../entities/order-invoice.entity';

export class ListInvoicesDto {
    page?: number;
    limit?: number;
    search?: string; // billing_name, billing_id_number, legacy_invoice_number, order_number
    status?: InvoiceEmissionStatus;
    from?: string; // fecha ISO
    to?: string;   // fecha ISO
}