// ─── DTO de salida ────────────────────────────────────────────────────────────
export interface OrderListItemDto {
    id: number;
    order_number: number;
    revisadoAntes: boolean;

    // Entidades
    currentStatus: { id: number; name: string };
    type: { id: number; name: string };
    branch: { id: string; name: string };
    customer: { id: number; firstName: string; lastName: string };
    device?: { model?: string; brand?: string; type?: string };
    technicians: { id: string; first_name: string; last_name: string }[];

    // Fechas
    entry_date: Date;
    finalized_at: Date | null;   // cuando llegó a TRABAJO FINALIZADO (status id=7)
    completed_at: Date | null;   // cuando llegó a ENTREGADA (status id=8)

    // Precios
    estimated_price: number | null;
    total_procedures_cost: number;
    total_paid: number;

    // Hallazgos
    findings_summary: {
        total: number;
        resolved: number;
        pending: number;
    };

    // Garantía
    has_active_warranty: boolean;
}