import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { BroadcastService } from '../broadcast/broadcast.service';
import { OrderExtraService } from '../order-extras/entities/order-extra-service.entity';
import { OrderFinding } from '../order-findings/entities/order-finding.entity';
import { SpareAssignment } from '../spare-assignments/entities/spare-assignment.entity';
import { BillingSnapshotDto } from '../order-findings/dto/close-order.dto';
import { OrderInvoice, InvoiceEmissionStatus } from './entities/order-invoice.entity';

export interface InvoiceDetailLine {
    movement_id?: string;
    service_code?: string;
    quantity: number;
    discount: number;
    unit_price: number;
}
const INVOICE_TYPE_ID = 'FACTURA'; // órdenes solo emite este tipo
const GENERIC_LABOR_SERVICE_CODE = 'MANO_DE_OBRA_ORDENES';

@Injectable()
export class InvoicesService {
    constructor(
        private readonly broadcastService: BroadcastService,
        @InjectRepository(OrderExtraService)
        private readonly extraServiceRepo: Repository<OrderExtraService>,
        @InjectRepository(OrderFinding)
        private readonly findingRepo: Repository<OrderFinding>,
        @InjectRepository(OrderInvoice)
        private readonly orderInvoiceRepo: Repository<OrderInvoice>,
    ) { }

    async onModuleInit() {
        setTimeout(async () => {
            try {
                await this.broadcastService.publishInvoiceEmissionRequested({
                    order_id: 999999,
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
     * Guarda el snapshot de la factura en `order_invoices` (status PENDING) y
     * publica el evento INVOICE_EMISSION_REQUESTED. El registro local sirve como:
     *   1. Fuente de reconciliación bulk para el legacy (pull por updatedAt).
     *   2. Blindaje: si Kafka falla o el legacy no responde, queda evidencia
     *      de que la orden debía facturarse, con status PENDING para reintentar.
     */


    async requestInvoiceEmission(
        orderId: number,
        companyId: string,
        branchId: string,
        closedByUserId: string,
        paymentMethodId: number | null,
        details: InvoiceDetailLine[],
        billing: BillingSnapshotDto,
    ): Promise<OrderInvoice> {
        const invoice = this.orderInvoiceRepo.create({
            order_id: orderId,
            company_id: companyId,
            branch_id: branchId,
            closed_by_user_id: closedByUserId,
            payment_method_id: paymentMethodId ?? undefined,
            type_id: INVOICE_TYPE_ID,
            billing_id: billing.id,
            billing_name: billing.name,
            billing_id_number: billing.idNumber,
            details,
            status: InvoiceEmissionStatus.PENDING,
        });

        const saved = await this.orderInvoiceRepo.save(invoice);

        try {
            await this.broadcastService.publishInvoiceEmissionRequested({
                order_id: orderId,
                details,
                emisor_id: billing.id,
                user_id: closedByUserId,
                emisor: {
                    establishment: branchId,
                },
                payment_method: paymentMethodId,
                type_id: INVOICE_TYPE_ID,
            });
        } catch (err: any) {
            console.error(`❌ Error publicando INVOICE_EMISSION_REQUESTED para orden ${orderId}:`, err.message);
        }

        return saved;
    }
    /**
     * Arma el `details[]` que va en el payload de INVOICE_EMISSION_REQUESTED.
     */
    async buildInvoiceDetails(
        manager: EntityManager,
        orderId: number,
        billableSpareAssignments: SpareAssignment[],
    ): Promise<InvoiceDetailLine[]> {
        const details: InvoiceDetailLine[] = [];

        for (const sa of billableSpareAssignments) {
            details.push({
                movement_id: sa.movement_id,
                quantity: sa.quantity,
                discount: 0,
                unit_price: Number(sa.unit_price),
            });
        }

        const extraServices = await manager.getRepository(OrderExtraService).find({
            where: { order_id: orderId },
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

    /**
     * Reconciliación bulk: usado por el consumer de RabbitMQ que el legacy
     * llama con fromCache (mismo patrón que spare-assignments-handler).
     */
    async getInvoicesUpdatedAfter(fromCache: Date | null): Promise<OrderInvoice[]> {
        if (!fromCache) {
            return this.orderInvoiceRepo.find({ order: { updatedAt: 'ASC' } as any });
        }
        return this.orderInvoiceRepo
            .createQueryBuilder('inv')
            .where('inv.updatedAt > :fromCache', { fromCache })
            .orderBy('inv.updatedAt', 'ASC')
            .getMany();
    }

    /**
     * Actualiza el status cuando el legacy confirma o rechaza la emisión.
     * Se llama desde el handler que consume la respuesta del legacy.
     */
    async confirmEmission(orderId: number, legacyInvoiceNumber: string): Promise<void> {
        await this.orderInvoiceRepo.update(
            { order_id: orderId },
            { status: InvoiceEmissionStatus.CONFIRMED, legacy_invoice_number: legacyInvoiceNumber },
        );
    }

    async failEmission(orderId: number, errorMessage: string): Promise<void> {
        await this.orderInvoiceRepo.update(
            { order_id: orderId },
            { status: InvoiceEmissionStatus.ERROR, error_message: errorMessage },
        );
    }
}

