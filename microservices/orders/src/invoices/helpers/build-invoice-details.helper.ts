// Helper para armar el `details[]` que va en el payload de INVOICE_EMISSION_REQUESTED.
// Se llama DESPUÉS del commit de la transacción de closeOrder, solo cuando
// `shouldEmitInvoice === true` (ver validación de is_billable_in_repair_orders).
//
// Resolución de ids de Mongo (product_id / batche_id / service_id) es
// responsabilidad del LEGACY (invoiceService.js), no de `orders`:
//   - Repuestos: se manda `movement_id` (SpareAssignment.movement_id). El legacy
//     busca ese movimiento en Mongo y de ahí saca product_id y batche_id.
//   - Mano de obra: se manda un `service_code` genérico y estable. El legacy
//     hace find-or-create sobre RepairService con ese código.

import { EntityManager } from "typeorm";
import { OrderExtraService } from "../../order-extras/entities/order-extra-service.entity";
import { OrderFinding } from "../../order-findings/entities/order-finding.entity";
import { SpareAssignment } from "../../spare-assignments/entities/spare-assignment.entity";

interface InvoiceDetailLine {
    movement_id?: string;
    service_code?: string;
    quantity: number;
    discount: number;
    unit_price: number;
}

// TODO: confirmar si es un código único fijo para todo el sistema, o varía
// por tipo de servicio/sucursal (ver pregunta abajo).
const GENERIC_LABOR_SERVICE_CODE = 'MANO_DE_OBRA_ORDENES';

async function buildInvoiceDetails(
    manager: EntityManager,
    orderId: number,
    billableSpareAssignments: SpareAssignment[], // ya filtrados: status ACTIVE + is_billable_in_repair_orders === true
): Promise<InvoiceDetailLine[]> {
    const details: InvoiceDetailLine[] = [];

    // ── 1. Repuestos facturables ─────────────────────────────────────────
    for (const sa of billableSpareAssignments) {
        details.push({
            movement_id: sa.movement_id, // el legacy resuelve product_id/batche_id a partir de esto
            quantity: sa.quantity,
            discount: 0,
            unit_price: Number(sa.unit_price), // precio con el que se asignó el repuesto en la orden
        });
    }

    // ── 2. Mano de obra combinada (extras + procedimientos) ─────────────
    const extraServices = await manager.getRepository(OrderExtraService).find({
        where: { order_id: orderId }, // deletedAt es soft-delete de TypeORM, find() ya excluye los borrados por default
    });

    const totalExtras = extraServices.reduce(
        (sum, s) => sum + Number(s.total_price || 0),
        0,
    );

    const findings = await manager.getRepository(OrderFinding).find({
        where: { order_id: orderId, is_active: true },
        relations: ['procedures'],
    });

    const totalProcedures = findings.reduce((sum, finding) => {
        const procSum = (finding.procedures || [])
            .filter((p) => p.is_active)
            .reduce((s, p) => s + Number(p.procedure_cost || 0), 0);
        return sum + procSum;
    }, 0);

    const totalManoDeObra = totalExtras + totalProcedures;

    if (totalManoDeObra > 0) {
        details.push({
            service_code: GENERIC_LABOR_SERVICE_CODE,
            quantity: 1,
            discount: 0,
            unit_price: totalManoDeObra,
        });
    }

    return details;
}