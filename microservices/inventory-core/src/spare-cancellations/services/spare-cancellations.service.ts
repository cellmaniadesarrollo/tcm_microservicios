import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { DataSource, EntityManager, In } from 'typeorm';
import { KafkaProducerService } from '../../kafka/kafka.producer';
import { SPARE_EVENTS, SPARE_TOPICS } from '../../outbox/constants/outbox-topics';
import { OrderReplica } from '../../orders-relay/entities/order-replica.entity';
import { ORDER_STATUSES_BLOCK_RETURN, VoucherDirection } from '../../stock-vouchers/enums/stock-voucher.enums';
import { StockVoucherLine } from '../../stock-vouchers/entities/stock-voucher-line.entity';
import { StockVoucher } from '../../stock-vouchers/entities/stock-voucher.entity';
import { CancellationStatus, SpareCancellationRequest } from '../entities/spare-cancellation-request.entity';
import { OutboxInput, OutboxService } from '../../outbox/services/outbox.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STARTUP_DELAY_MS = 15_000;                                           // deja que Kafka conecte antes de responder
const SWEEP_MS = Number(process.env.SPARE_SWEEP_MS) || 60_000;
const RECONCILE_MS = Number(process.env.SPARE_RECONCILE_MS) || 10 * 60_000;
const SAFETY_MARGIN_MS = 5 * 60_000;

@Injectable()
export class SpareCancellationsService implements OnModuleInit, OnModuleDestroy {
    private timers: NodeJS.Timeout[] = [];
    private sweeping = false;
    private reconciling = false;

    constructor(
        private readonly dataSource: DataSource,
        private readonly kafkaProducer: KafkaProducerService,
        private readonly outbox: OutboxService,
        @Inject('ORDERS_CANCELLATIONS_SYNC') private readonly ordersClient: ClientProxy | null,
    ) { }

    onModuleInit() {

        const first = setTimeout(() => { void this.recover(true); }, STARTUP_DELAY_MS);
        const sweep = setInterval(() => { void this.sweepFullyReturned().catch((e) => console.error('❌ [Cancelación] barrido:', e?.message)); }, SWEEP_MS);
        const rec = setInterval(() => { void this.recover(false); }, RECONCILE_MS);
        [first, sweep, rec].forEach((t) => t.unref());
        this.timers.push(first, sweep, rec);
    }

    onModuleDestroy() {
        this.timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    }

    /** Arranque y ciclo: primero cierra lo que ya está devuelto, luego reconcilia con órdenes. */
    private async recover(resendPending: boolean) {

        try { await this.sweepFullyReturned(); }
        catch (e: any) { console.error('❌ [Cancelación] barrido:', e?.message); }
        try { await this.reconcileWithOrders(resendPending); }
        catch (e: any) { console.warn('⚠️ [Cancelación] reconciliación omitida:', e?.message ?? e); }
    }

    /**
     * Procesa SPARE_CANCELLATION_REQUESTED. Idempotente por request_id:
     * una reentrega solo reenvía la respuesta guardada. Si no puede responder, lanza
     * (el consumer reintenta y luego manda a la DLQ).
     */
    async handleRequested(data: any): Promise<void> {
        const requestId = String(data?.request_id ?? '');
        if (!UUID_RE.test(requestId)) {
            console.error('❌ [Cancelación] solicitud sin request_id válido, se descarta:', JSON.stringify(data));
            return; // no hay a quién responder; reintentar no sirve
        }

        const repo = this.dataSource.getRepository(SpareCancellationRequest);

        const existing = await repo.findOne({ where: { requestId } });
        if (existing) return this.respond(existing);

        const movementId = String(data?.movement_id ?? '');
        const orderId = Number(data?.order_id);

        const { companyId, error } = await this.validate(movementId, orderId);

        const row = repo.create({
            requestId,
            companyId: companyId ?? null,
            movementId,
            orderId: Number.isInteger(orderId) ? orderId : 0,
            status: error ? CancellationStatus.REJECTED : CancellationStatus.PENDING,
            errorDetail: error ?? null,
            reason: typeof data?.reason === 'string' ? data.reason.slice(0, 500) : null,
            requestedById: data?.requested_by_id != null ? String(data.requested_by_id).slice(0, 100) : null,
        });

        let saved: SpareCancellationRequest;
        try {
            saved = await repo.save(row);
        } catch (e: any) {
            if (e?.code !== '23505') throw e;
            const dup = await repo.findOne({ where: { requestId } });
            if (dup) return this.respond(dup); // reentrega concurrente
            // choca el índice de "una PENDING por línea": ya hay otra solicitud pendiente
            saved = await repo.save(repo.create({
                ...row,
                status: CancellationStatus.REJECTED,
                errorDetail: 'Ya existe una solicitud de cancelación pendiente para este repuesto',
            }));
        }

        await this.respond(saved);
    }

    /**
     * Confirma las solicitudes PENDING cuya línea ya quedó en saldo 0 (ventana de carrera o cierre perdido).
     * Misma lógica que el retorno: UPDATE a CONFIRMED + SPARE_CANCELLED(returned) por outbox, en una transacción.
     * Si el retorno real corre a la vez, el UPDATE de uno no encuentra PENDING y no duplica.
     */
    async sweepFullyReturned(): Promise<number> {
        if (this.sweeping) return 0;
        this.sweeping = true;
        try {
            const ids: string[] = [];
            await this.dataSource.transaction(async (em) => {
                const rows: Array<{ company_id: string; movement_id: string }> = await em.query(
                    `SELECT c.company_id, c.movement_id
                       FROM spare_cancellation_requests c
                       JOIN stock_voucher_lines l ON l.id::text = c.movement_id
                      WHERE c.status = $1
                        AND c.company_id IS NOT NULL
                        AND l.quantity - COALESCE((SELECT SUM(r.quantity) FROM stock_voucher_lines r WHERE r.origin_line_id = l.id), 0) <= 0
                      LIMIT 200`,
                    [CancellationStatus.PENDING],
                );
                if (!rows.length) return;

                const byCompany = new Map<string, string[]>();
                for (const r of rows) {
                    const list = byCompany.get(r.company_id) ?? [];
                    list.push(r.movement_id);
                    byCompany.set(r.company_id, list);
                }
                for (const [companyId, lineIds] of byCompany) {
                    const events: OutboxInput[] = await this.confirmForReturnedLines(em, companyId, lineIds);
                    ids.push(...(await this.outbox.enqueue(em, events)));
                }
            });

            if (ids.length) {
                console.log(`🧹 [Cancelación] barrido: ${ids.length} solicitud(es) confirmada(s)`);
                await this.outbox.dispatchNow(ids);
            }
            return ids.length;
        } finally {
            this.sweeping = false;
        }
    }

    /**
     * Pide a órdenes sus solicitudes PENDING y procesa las de líneas de este MS.
     * - Sin fila local: la crea y responde (solicitud que se perdió o cayó a la DLQ).
     * - Con fila local CONFIRMED o REJECTED: reenvía la respuesta (se perdió el SPARE_CANCELLED).
     * - Con fila local PENDING: solo se reenvía en el arranque (`resendPending`), para no repetir
     *   "cancellation_requested" cada ciclo mientras bodega decide.
     * Las solicitudes legacy (movement_id que no es uuid de una línea nuestra) se ignoran: NUNCA se responde por ellas.
     */
    private async reconcileWithOrders(resendPending: boolean) {

        if (!this.ordersClient) return; // sin ORDERS_CANCELLATIONS_QUEUE
        if (this.reconciling) return;
        this.reconciling = true;
        try {
            const repo = this.dataSource.getRepository(SpareCancellationRequest);

            // Las PENDING de órdenes vienen siempre, sin importar fromCache; este solo acota el resto.
            const last = await repo.createQueryBuilder('c').select('MAX(c.updatedAt)', 'max').getRawOne();
            const fromCache = last?.max ? new Date(new Date(last.max).getTime() - SAFETY_MARGIN_MS).toISOString() : null;

            const remote: any[] = await firstValueFrom(
                this.ordersClient
                    .send({ cmd: 'async_spare_cancellations_start' }, { internalToken: process.env.INTERNAL_SECRET, fromCache })
                    .pipe(timeout(30_000)),
            );

            const pending = (remote ?? []).filter(
                (r) => r?.status === 'PENDING' && UUID_RE.test(String(r.request_id)) && UUID_RE.test(String(r.movement_id)),
            );
            if (!pending.length) return;

            const lineIds = [...new Set(pending.map((r) => String(r.movement_id).toLowerCase()))];
            const lines = await this.dataSource.getRepository(StockVoucherLine).find({
                where: { id: In(lineIds) },
                select: { id: true },
            });
            const mine = new Set(lines.map((l) => l.id));
            const mineRows = pending.filter((r) => mine.has(String(r.movement_id).toLowerCase()));
            if (!mineRows.length) return;

            const local = await repo.find({
                where: { requestId: In(mineRows.map((r) => String(r.request_id).toLowerCase())) },
                select: { requestId: true, status: true },
            });
            const localStatus = new Map(local.map((l) => [l.requestId, l.status] as [string, CancellationStatus]));

            let done = 0;
            for (const r of mineRows) {
                const st = localStatus.get(String(r.request_id).toLowerCase());
                if (st === CancellationStatus.PENDING && !resendPending) continue;
                try {
                    await this.handleRequested(r); // idempotente por request_id
                    done++;
                } catch (e: any) {
                    console.warn(`⚠️ [Cancelación] no se pudo reconciliar ${r.request_id}: ${e?.message}`);
                }
            }
            if (done) console.log(`🔁 [Cancelación] reconciliadas ${done} solicitud(es) con órdenes`);
        } finally {
            this.reconciling = false;
        }
    }

    /** Devuelve error (texto en español) si la solicitud no procede. */
    private async validate(movementId: string, orderId: number): Promise<{ companyId?: string; error?: string }> {
        if (!UUID_RE.test(movementId) || !Number.isInteger(orderId) || orderId <= 0) {
            return { error: 'Asignación no encontrada' };
        }
        const em = this.dataSource.manager;

        const line = await em.findOne(StockVoucherLine, { where: { id: movementId.toLowerCase() } });
        if (!line) return { error: 'Asignación no encontrada' };

        const voucher = await em.findOne(StockVoucher, { where: { id: line.voucherId } });
        if (!voucher) return { error: 'Asignación no encontrada' };

        const companyId = voucher.companyId;
        if (voucher.direction !== VoucherDirection.OUT || voucher.orderId !== orderId) {
            return { companyId, error: 'El repuesto no pertenece a esta orden' };
        }

        const order = await em.findOne(OrderReplica, { where: { id: orderId, company_id: companyId } });
        if (!order) return { companyId, error: 'No se pudo verificar el estado de la orden, intenta de nuevo en unos minutos' };
        if (ORDER_STATUSES_BLOCK_RETURN.includes(order.status_id)) {
            return { companyId, error: `La orden está ${order.status_name} y ya no admite cambios` };
        }

        const ret = await em
            .createQueryBuilder(StockVoucherLine, 'r')
            .select('COALESCE(SUM(r.quantity), 0)::int', 'returned')
            .where('r.origin_line_id = :id', { id: line.id })
            .getRawOne();
        if (line.quantity - Number(ret?.returned ?? 0) <= 0) {
            return { companyId, error: 'El repuesto ya fue devuelto a bodega' };
        }

        return { companyId };
    }

    /** SPARE_CANCELLED hacia órdenes. Lanza si Kafka no acepta (emit devuelve false). */
    private async respond(row: SpareCancellationRequest): Promise<void> {
        const rejected = row.status === CancellationStatus.REJECTED;
        const payload: Record<string, unknown> = {
            request_id: row.requestId,
            movement_id: row.movementId,
            order_id: row.orderId,
            // PENDING -> cancellation_requested; CONFIRMED -> returned (lo manda el paso 10); REJECTED -> active + detalle
            assignment_status: rejected ? 'active' : row.status === CancellationStatus.CONFIRMED ? 'returned' : 'cancellation_requested',
            ...(rejected ? { error_detail: row.errorDetail ?? 'No se pudo procesar la solicitud' } : {}),
        };

        const ok = await this.kafkaProducer.emit(
            SPARE_TOPICS.CANCELLED, SPARE_EVENTS.CANCELLED, payload, row.movementId, row.id,
        );
        if (!ok) throw new Error(`No se pudo responder la solicitud ${row.requestId}; se reintentará`);
        console.log(`📨 [Cancelación] ${row.requestId} → ${payload.assignment_status}`);
    }

    /**
     * Cierra las solicitudes PENDING de las líneas que acaban de quedar totalmente retornadas.
     * Se llama DENTRO de la transacción del retorno (mismo `em`). Devuelve los SPARE_CANCELLED
     * a encolar en el outbox; el que llama los encola.
     */
    async confirmForReturnedLines(em: EntityManager, companyId: string, lineIds: string[]): Promise<OutboxInput[]> {
        if (!lineIds.length) return [];

        const res: any = await em.query(
            `UPDATE spare_cancellation_requests
                SET status = $3, confirmed_at = now(), updated_at = now(), error_detail = NULL
              WHERE company_id = $1
                AND movement_id = ANY($2::varchar[])
                AND status = $4
          RETURNING request_id, movement_id, order_id`,
            [companyId, lineIds, CancellationStatus.CONFIRMED, CancellationStatus.PENDING],
        );
        // UPDATE ... RETURNING puede venir como [filas, n] o como filas
        const rows: any[] = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : res;

        return rows.map((r) => ({
            companyId,
            topic: SPARE_TOPICS.CANCELLED,
            eventType: SPARE_EVENTS.CANCELLED,
            key: r.movement_id, // misma key que el SPARE_RETURNED: sale después de él
            payload: {
                request_id: r.request_id,
                movement_id: r.movement_id,
                order_id: Number(r.order_id),
                assignment_status: 'returned',
            },
        }));
    }
}