import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { BroadcastService } from '../broadcast/broadcast.service';
import { OrderExtraService } from '../order-extras/entities/order-extra-service.entity';
import { OrderFinding } from '../order-findings/entities/order-finding.entity';
import { SpareAssignment } from '../spare-assignments/entities/spare-assignment.entity';
import { BillingSnapshotDto } from '../order-findings/dto/close-order.dto';
import { Order } from '../order-workflow/entities/order.entity';
import { OrderInvoice, InvoiceEmissionStatus } from './entities/order-invoice.entity';
import { ListInvoicesDto } from './dto/list-invoices.dto';
import { InvoiceIssuedEventDto } from './dto/invoice-status-event.dto';

export interface InvoiceDetailLine {
    movement_id?: string;
    service_code?: string;
    quantity: number;
    discount: number;
    unit_price: number;
}

interface AuthContext {
    userId: string;
    companyId: string;
    branchId?: string;
}

const INVOICE_TYPE_ID = 'FACTURA';
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

    async confirmEmission(event: InvoiceIssuedEventDto): Promise<void> {
        const invoiceStatus =
            event.status === 'success' ? InvoiceEmissionStatus.CONFIRMED : InvoiceEmissionStatus.ERROR;
        // 'pending' (SRI aún no responde) lo dejamos como CONFIRMED igual,
        // porque la factura SÍ se emitió del lado del legacy; solo falta el
        // veredicto del SRI. Si prefieres un tercer estado, lo agregamos al enum.

        await this.orderInvoiceRepo.update(
            { order_id: event.order_id },
            {
                status: invoiceStatus,
                legacy_invoice_id: event.invoice_id,
                legacy_invoice_number: event.invoice_number,
                legacy_issue_date: event.issue_date ? new Date(event.issue_date) : undefined,
                legacy_subtotal: event.subtotal,
                legacy_total: event.total,
                legacy_clave_acceso: event.clave_acceso,
                legacy_code_establecimiento: event.code_establecimiento,
                legacy_code_punto_emision: event.code_punto_emision,
                legacy_payment_code: event.payment_code,
                legacy_sri_response: event.sri_response
                    ? JSON.parse(event.sri_response)
                    : undefined,
                error_message: invoiceStatus === InvoiceEmissionStatus.ERROR ? 'Rechazada por el SRI' : null,
            },
        );
    }

    async failEmission(orderId: number, errorMessage: string): Promise<void> {
        await this.orderInvoiceRepo.update(
            { order_id: orderId },
            { status: InvoiceEmissionStatus.ERROR, error_message: errorMessage },
        );
    }

    // ───────────────────────── Endpoints REST (vía gateway) ─────────────────────────

    /**
     * Listado paginado de facturas para el módulo de facturación.
     */
    async listInvoices(dto: ListInvoicesDto, user: any) {
        const companyId = user.companyId;
        const branchId = user.branchId;

        const page = dto.page && dto.page > 0 ? dto.page : 1;
        const limit = dto.limit && dto.limit > 0 ? dto.limit : 20;

        const qb = this.orderInvoiceRepo
            .createQueryBuilder('invoice')
            .leftJoin(Order, 'order', 'order.id = invoice.order_id')
            .addSelect(['order.order_number', 'order.public_id'])
            .where('invoice.company_id = :companyId', { companyId });

        if (branchId) {
            qb.andWhere('invoice.branch_id = :branchId', { branchId });
        }
        if (dto.status) {
            qb.andWhere('invoice.status = :status', { status: dto.status });
        }
        if (dto.search) {
            qb.andWhere(
                `(invoice.billing_name ILIKE :search
                  OR invoice.billing_id_number ILIKE :search
                  OR invoice.legacy_invoice_number ILIKE :search
                  OR CAST(order.order_number AS TEXT) ILIKE :search)`,
                { search: `%${dto.search}%` },
            );
        }
        if (dto.from) {
            qb.andWhere('invoice.createdAt >= :from', { from: dto.from });
        }
        if (dto.to) {
            qb.andWhere('invoice.createdAt <= :to', { to: dto.to });
        }

        qb.orderBy('invoice.updatedAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);

        const [items, total] = await qb.getManyAndCount();

        return {
            items,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    /**
     * Reenvía una factura: republica INVOICE_EMISSION_REQUESTED al MISMO topic
     * que usa la emisión original, reutilizando el snapshot ya guardado
     * (no recalcula details[] — evita inconsistencias si SpareAssignment/
     * OrderFinding cambiaron después del cierre).
     */
    async resendInvoice(invoiceId: number, user: any): Promise<OrderInvoice> {
        const invoice = await this.orderInvoiceRepo.findOne({
            where: { id: invoiceId, company_id: user.companyId },
        });

        if (!invoice) {
            throw new NotFoundException(`Factura ${invoiceId} no encontrada`);
        }

        invoice.status = InvoiceEmissionStatus.PENDING;
        invoice.error_message = '';
        const saved = await this.orderInvoiceRepo.save(invoice);

        try {
            await this.broadcastService.publishInvoiceEmissionRequested({
                order_id: saved.order_id,
                details: saved.details,
                emisor_id: saved.billing_id,
                user_id: saved.closed_by_user_id,
                emisor: {
                    establishment: saved.branch_id,
                },
                payment_method: saved.payment_method_id,
                type_id: saved.type_id,
                is_resend: true, // permite al legacy distinguir retry de emisión original si necesita upsert
            });
        } catch (err: any) {
            console.error(`❌ Error republicando INVOICE_EMISSION_REQUESTED (reenvío) orden ${saved.order_id}:`, err.message);
            saved.status = InvoiceEmissionStatus.ERROR;
            saved.error_message = `Error al republicar: ${err.message?.slice(0, 450)}`;
            await this.orderInvoiceRepo.save(saved);
            throw err;
        }

        return saved;
    }
}