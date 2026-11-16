import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
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
import { ListSpareCancellationsQuery, SpareCancellationSortBy, SpareCancellationStatusFilter } from '../types/spare-cancellation-list.types';
import { escapeLike, norm, toTokens } from '../../common/helpers/search-sql';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction } from '../../audit-log/enums/audit-action.enum';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STARTUP_DELAY_MS = 15_000;                                           // deja que Kafka conecte antes de responder
const SWEEP_MS = Number(process.env.SPARE_SWEEP_MS) || 60_000;
const RECONCILE_MS = Number(process.env.SPARE_RECONCILE_MS) || 10 * 60_000;
const SAFETY_MARGIN_MS = 5 * 60_000;

const LIST_DEFAULT_LIMIT = 20;
const LIST_MAX_LIMIT = 100;

const LIST_SORT_SQL: Record<SpareCancellationSortBy, string> = {
    createdAt: 'c.created_at',
    orderNumber: 'COALESCE(o.order_number, v.order_number)',
    productName: 'pn.name',
    sku: 'p.sku',
};

const LIST_FROM_SQL = `
    FROM spare_cancellation_requests c
    JOIN stock_voucher_lines l ON l.id::text = lower(c.movement_id)
    JOIN stock_vouchers v ON v.id = l.voucher_id AND v.company_id = c.company_id
    JOIN products p ON p.id = l.product_id
    JOIN product_names pn ON pn.id = p.product_name_id
    JOIN lots lt ON lt.id = l.lot_id
    LEFT JOIN orders_replica o ON o.id = v.order_id AND o.company_id = v.company_id::text`;

@Injectable()
export class SpareCancellationsService implements OnModuleInit, OnModuleDestroy {
    private timers: NodeJS.Timeout[] = [];
    private sweeping = false;
    private reconciling = false;

    constructor(
        private readonly dataSource: DataSource,
        private readonly kafkaProducer: KafkaProducerService,
        private readonly outbox: OutboxService,
        private readonly audit: AuditLogService,
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

    /**
 * Bandeja de bodega: solicitudes de cancelación con lo necesario para precargar el retorno
 * (originVoucherId + originLineId). Solo lectura. Por defecto solo PENDING.
 */
    async list(query: ListSpareCancellationsQuery, companyId: string) {
        const bad400 = (m: string) => new RpcException(new BadRequestException(m));

        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(LIST_MAX_LIMIT, Math.max(1, Number(query.limit) || LIST_DEFAULT_LIMIT));

        const status: SpareCancellationStatusFilter = query.status ?? CancellationStatus.PENDING;
        if (status !== 'ALL' && !Object.values(CancellationStatus).includes(status)) {
            throw bad400('El estado de la solicitud no es válido');
        }

        const sortBy: SpareCancellationSortBy = query.sortBy && LIST_SORT_SQL[query.sortBy] ? query.sortBy : 'createdAt';
        const sortDir = query.sortDir === 'ASC' || query.sortDir === 'DESC' ? query.sortDir : sortBy === 'createdAt' ? 'DESC' : 'ASC';

        // $1 = empresa, $2 = estado; el resto se agrega según la búsqueda
        // $1 = empresa; el estado solo se agrega si no es ALL
        const params: unknown[] = [companyId];
        const where: string[] = ['c.company_id = $1'];
        if (status !== 'ALL') {
            params.push(status);
            where.push(`c.status = $${params.length}`);
        }

        // Cada palabra debe coincidir (AND) con algún campo (OR), sin tildes ni mayúsculas
        for (const token of toTokens(query.search)) {
            params.push(`%${escapeLike(token)}%`);
            const like = `$${params.length}`;
            const ors = [
                `${norm('pn.name')} LIKE ${like}`,
                `lower(p.sku) LIKE ${like}`,
                `${norm('o.customer_name')} LIKE ${like}`,
                `${norm(`concat_ws(' ', o.device_brand, o.device_model)`)} LIKE ${like}`,
                `${norm('c.reason')} LIKE ${like}`,
            ];
            // Un entero también puede ser el número de orden o el código del vale
            if (/^\d{1,9}$/.test(token)) {
                params.push(Number(token));
                const n = `$${params.length}`;
                ors.push(`COALESCE(o.order_number, v.order_number) = ${n}`, `v.code = ${n}`);
            }
            where.push(`(${ors.join(' OR ')})`);
        }
        const whereSql = `WHERE ${where.join(' AND ')}`;

        const countRows: Array<{ total: number }> = await this.dataSource.query(
            `SELECT COUNT(*)::int AS total ${LIST_FROM_SQL} ${whereSql}`,
            params,
        );
        const total = Number(countRows[0]?.total ?? 0);

        const pageParams = [...params, limit, (page - 1) * limit];
        const rows: any[] = await this.dataSource.query(
            `SELECT c.id, c.request_id AS "requestId", c.status, c.reason,
                    c.requested_by_id AS "requestedById", c.error_detail AS "errorDetail",
                    c.confirmed_at AS "confirmedAt", c.created_at AS "createdAt",
                    c.order_id AS "orderId",
                    COALESCE(o.order_number, v.order_number) AS "orderNumber",
                    o.customer_name AS "customerName",
                    o.status_id AS "orderStatusId", o.status_name AS "orderStatusName",
                    o.device_brand AS "deviceBrand", o.device_model AS "deviceModel",
                    v.id AS "originVoucherId", v.code AS "originVoucherCode",
                    l.id AS "originLineId", l.line_no AS "lineNo", l.quantity,
                    COALESCE((SELECT SUM(r.quantity) FROM stock_voucher_lines r WHERE r.origin_line_id = l.id), 0)::int AS "returned",
                    p.id AS "productId", p.sku, pn.name AS "productName",
                    lt.id AS "lotId", lt.code AS "lotCode"
             ${LIST_FROM_SQL}
             ${whereSql}
             ORDER BY ${LIST_SORT_SQL[sortBy]} ${sortDir}, c.id ASC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            pageParams,
        );

        const items = rows.map((r) => {
            const quantity = Number(r.quantity);
            const returned = Number(r.returned);
            return {
                id: r.id,
                requestId: r.requestId,
                status: r.status,
                reason: r.reason ?? null,
                requestedById: r.requestedById ?? null,
                errorDetail: r.errorDetail ?? null,
                createdAt: r.createdAt,
                confirmedAt: r.confirmedAt ?? null,
                order: {
                    id: r.orderId,
                    number: r.orderNumber != null ? Number(r.orderNumber) : null,
                    customerName: r.customerName ?? null,
                    statusId: r.orderStatusId ?? null,
                    statusName: r.orderStatusName ?? null,
                    device: [r.deviceBrand, r.deviceModel].filter(Boolean).join(' ') || null,
                },
                // Para precargar el retorno NO_REQUERIDO
                originVoucherId: r.originVoucherId,
                originVoucherCode: Number(r.originVoucherCode),
                originLineId: r.originLineId,
                lineNo: Number(r.lineNo),
                product: { id: r.productId, sku: r.sku, name: r.productName },
                lot: { id: r.lotId, code: Number(r.lotCode) },
                quantity,
                returned,
                pending: Math.max(0, quantity - returned),
            };
        });

        const includeFilters = query.includeFilters === true || query.includeFilters === 'true';

        return {
            items,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
            ...(includeFilters
                ? {
                    filters: {
                        statuses: [
                            { value: 'ALL', label: 'Todas' },
                            { value: CancellationStatus.PENDING, label: 'Pendientes' },
                            { value: CancellationStatus.CONFIRMED, label: 'Confirmadas' },
                            { value: CancellationStatus.REJECTED, label: 'Rechazadas' },
                        ],
                        sortOptions: [
                            { value: 'createdAt', label: 'Más recientes' },
                            { value: 'orderNumber', label: 'Número de orden' },
                            { value: 'productName', label: 'Producto' },
                            { value: 'sku', label: 'SKU' },
                        ],
                    },
                }
                : {}),
        };
    }

    /**
  * Bodega rechaza una solicitud PENDING: queda REJECTED y órdenes recibe
  * SPARE_CANCELLED(active + error_detail) por outbox, en la misma transacción.
  */
    async reject(id: string, reason: unknown, companyId: string, userId: string) {
        const bad400 = (m: string) => new RpcException(new BadRequestException(m));

        if (!UUID_RE.test(id)) throw bad400('La solicitud no es válida');
        const detail = typeof reason === 'string' ? reason.trim() : '';
        if (detail.length < 3) throw bad400('Indica el motivo del rechazo (mínimo 3 caracteres)');
        if (detail.length > 500) throw bad400('El motivo del rechazo es demasiado largo (máximo 500 caracteres)');

        let outboxIds: string[] = [];
        let replayed = false;

        const result = await this.dataSource.transaction(async (em) => {
            const found: any[] = await em.query(
                `SELECT id, request_id, movement_id, order_id, status
                   FROM spare_cancellation_requests
                  WHERE id = $1 AND company_id = $2
                    FOR UPDATE`,
                [id.toLowerCase(), companyId],
            );
            const row = found[0];
            if (!row) throw new RpcException(new NotFoundException('La solicitud no existe'));

            if (row.status === CancellationStatus.REJECTED) {
                replayed = true;
                return { id: row.id, status: CancellationStatus.REJECTED };
            }
            if (row.status === CancellationStatus.CONFIRMED) {
                throw new RpcException(new ConflictException('La solicitud ya fue confirmada por un retorno'));
            }

            // Si la línea ya no tiene saldo, el barrido la confirma: rechazarla dejaría a órdenes con "active" sobre un repuesto devuelto
            const bal: any[] = await em.query(
                `SELECT l.quantity - COALESCE((SELECT SUM(r.quantity) FROM stock_voucher_lines r WHERE r.origin_line_id = l.id), 0) AS pending
                   FROM stock_voucher_lines l
                  WHERE l.id::text = lower($1)`,
                [row.movement_id],
            );
            if (!bal[0] || Number(bal[0].pending) <= 0) {
                throw new RpcException(new ConflictException('El repuesto ya fue devuelto a bodega; la solicitud se confirmará automáticamente'));
            }

            await em.query(
                `UPDATE spare_cancellation_requests
                    SET status = $2, error_detail = $3, updated_at = now()
                  WHERE id = $1`,
                [row.id, CancellationStatus.REJECTED, detail],
            );

            await this.audit.log(em, {
                companyId, entity: SpareCancellationRequest, entityId: row.id,
                action: AuditAction.UPDATED, userId,
                before: { status: CancellationStatus.PENDING },
                after: { status: CancellationStatus.REJECTED, errorDetail: detail },
            });

            outboxIds = await this.outbox.enqueue(em, [{
                companyId,
                topic: SPARE_TOPICS.CANCELLED,
                eventType: SPARE_EVENTS.CANCELLED,
                key: row.movement_id, // misma key de la línea: conserva el orden con sus otros eventos
                payload: {
                    request_id: row.request_id,
                    movement_id: row.movement_id,
                    order_id: Number(row.order_id),
                    assignment_status: 'active',
                    error_detail: detail,
                },
            }]);

            return { id: row.id, status: CancellationStatus.REJECTED };
        });

        // Fuera de la transacción: nunca lanza
        if (outboxIds.length) void this.outbox.dispatchNow(outboxIds);

        return { ...result, replayed };
    }
}