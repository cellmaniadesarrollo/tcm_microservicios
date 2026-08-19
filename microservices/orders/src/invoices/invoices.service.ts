import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { BroadcastService } from '../broadcast/broadcast.service';
import { OrderExtraService } from '../order-extras/entities/order-extra-service.entity';
import { OrderFinding } from '../order-findings/entities/order-finding.entity';
import { SpareAssignment } from '../spare-assignments/entities/spare-assignment.entity';

export interface InvoiceDetailLine {
    movement_id?: string;
    service_code?: string;
    quantity: number;
    discount: number;
    unit_price: number;
}

// TODO: confirmar si es un código único fijo para todo el sistema, o varía
// por tipo de servicio/sucursal.
const GENERIC_LABOR_SERVICE_CODE = 'MANO_DE_OBRA_ORDENES';

@Injectable()
export class InvoicesService {
    constructor(
        private readonly broadcastService: BroadcastService,
        @InjectRepository(OrderExtraService)
        private readonly extraServiceRepo: Repository<OrderExtraService>,
        @InjectRepository(OrderFinding)
        private readonly findingRepo: Repository<OrderFinding>,
    ) { }

    async onModuleInit() {
        // Pequeña espera para que el producer ya esté conectado
        setTimeout(async () => {
            try {
                await this.broadcastService.publishInvoiceEmissionRequested({
                    order_id: 999999, // id de prueba
                    test: true,
                    message: '✅ Mensaje de prueba: el módulo de facturas se inicializó correctamente',
                });
                console.log('🧪 [InvoicesService] Evento de prueba INVOICE_EMISSION_REQUESTED enviado');
            } catch (err: any) {
                console.error('❌ [InvoicesService] Error enviando evento de prueba:', err.message);
            }
        }, 2000);
    }

    /**
     * Publica el evento INVOICE_EMISSION_REQUESTED con el payload que consumirá
     * el handler de Kafka del legacy (kafka/handlers/invoiceHandler.js → emitInvoice).
     *
     * TODO: todavía falta agregar al payload:
     *   - user_id (del customer de la orden — pendiente confirmar mapeo Order.customer → Mongo user_id)
     *   - emisor_id (objeto: _id, identification, issuer_name, trade_name, cellphone)
     *   - emisor.establishment
     *   - tax_id
     *   - type_id
     *   - payment_method
     * Hasta que esos campos estén definidos, este payload NO alcanza para que
     * emitInvoice() del legacy pueda emitir la factura — solo deja armada la
     * parte de `details[]`.
     */
    async requestInvoiceEmission(
        orderId: number,
        details: InvoiceDetailLine[],
    ): Promise<{ ok: boolean }> {
        await this.broadcastService.publishInvoiceEmissionRequested({
            order_id: orderId,
            details,
            // TODO: user_id, emisor_id, emisor, tax_id, type_id, payment_method
        });
        return { ok: true };
    }

    /**
     * Arma el `details[]` que va en el payload de INVOICE_EMISSION_REQUESTED.
     * Se llama desde closeOrder() DESPUÉS del commit de la transacción, solo
     * cuando `shouldEmitInvoice === true` (todos los repuestos asignados son
     * is_billable_in_repair_orders).
     *
     * Resolución de ids de Mongo (product_id / batche_id / service_id) es
     * responsabilidad del LEGACY (invoiceService.js), no de este microservicio:
     *   - Repuestos: se manda `movement_id` (SpareAssignment.movement_id). El
     *     legacy busca ese movimiento en Mongo y de ahí saca product_id y batche_id.
     *   - Mano de obra: se manda un `service_code` genérico y estable. El legacy
     *     hace find-or-create sobre RepairService con ese código.
     *
     * @param manager - EntityManager de la transacción de closeOrder (para leer
     *   datos consistentes con lo que se acaba de commitear).
     * @param orderId
     * @param billableSpareAssignments - ya filtrados: status ACTIVE +
     *   is_billable_in_repair_orders === true.
     */
    async buildInvoiceDetails(
        manager: EntityManager,
        orderId: number,
        billableSpareAssignments: SpareAssignment[],
    ): Promise<InvoiceDetailLine[]> {
        const details: InvoiceDetailLine[] = [];

        // ── 1. Repuestos facturables ─────────────────────────────────────
        for (const sa of billableSpareAssignments) {
            details.push({
                movement_id: sa.movement_id, // el legacy resuelve product_id/batche_id a partir de esto
                quantity: sa.quantity,
                discount: 0,
                unit_price: Number(sa.unit_price), // precio con el que se asignó el repuesto en la orden
            });
        }

        // ── 2. Mano de obra combinada (extras + procedimientos) ─────────
        const extraServices = await manager.getRepository(OrderExtraService).find({
            where: { order_id: orderId }, // soft-delete de TypeORM excluye deletedAt por default
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
}