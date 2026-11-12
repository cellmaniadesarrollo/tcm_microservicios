import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, QueryDeepPartialEntity } from 'typeorm';

import { OutboxEvent, OutboxStatus } from '../entities/outbox-event.entity';
import { KafkaProducerService } from '../../kafka/kafka.producer';

export interface OutboxInput {
    companyId: string;
    topic: string;
    eventType: string;
    key: string;
    payload: Record<string, unknown>;
}

interface ClaimedRow {
    id: string;
    seq: string;
    topic: string;
    eventType: string;
    key: string;
    payload: Record<string, unknown>;
    attempts: number;
}

const POLL_MS = Number(process.env.OUTBOX_POLL_MS) || 3000;
const BATCH_SIZE = 20;
const LEASE_SECONDS = 60;                 // si el proceso cae a medio envío, la fila se reintenta tras este tiempo
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 15 * 60 * 1000;

@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
    private timer?: NodeJS.Timeout;
    private polling = false;

    constructor(
        private readonly dataSource: DataSource,
        private readonly kafkaProducer: KafkaProducerService,
    ) { }

    onModuleInit() {
        this.timer = setInterval(() => { void this.poll(); }, POLL_MS);
        this.timer.unref(); // no impide que el proceso termine
        console.log(`📮 Outbox poller activo (cada ${POLL_MS} ms)`);
    }

    onModuleDestroy() {
        if (this.timer) clearInterval(this.timer);
    }

    /**
     * Registra eventos DENTRO de la transacción del documento (mismo `em`).
     * Devuelve los ids para despacharlos después del commit.
     */
    async enqueue(em: EntityManager, events: OutboxInput[]): Promise<string[]> {
        if (!events.length) return [];
        const rows: QueryDeepPartialEntity<OutboxEvent>[] = events.map((e) => ({
            id: randomUUID(),
            companyId: e.companyId,
            topic: e.topic,
            eventType: e.eventType,
            key: e.key,
            payload: e.payload as any, // jsonb: QueryDeepPartialEntity no acepta Record<string, unknown>
        }));
        await em.insert(OutboxEvent, rows);
        return rows.map((r) => r.id as string);
    }

    /**
     * Intento inmediato tras el commit. NUNCA lanza: si falla, el poller lo reintenta.
     */
    async dispatchNow(ids: string[]): Promise<void> {
        if (!ids.length) return;
        try {
            await this.runBatch(ids);
        } catch (error: any) {
            console.error('❌ [Outbox] dispatchNow:', error?.message);
        }
    }

    private async poll() {
        if (this.polling) return; // evita ticks solapados
        this.polling = true;
        try {
            await this.runBatch();
        } catch (error: any) {
            console.error('❌ [Outbox] poll:', error?.message);
        } finally {
            this.polling = false;
        }
    }

    private async runBatch(ids?: string[]) {
        const rows = await this.claim(BATCH_SIZE, ids);
        if (!rows.length) return;

        // En orden de seq. Un fallo de una fila no frena las de otras keys.
        rows.sort((a, b) => (BigInt(a.seq) < BigInt(b.seq) ? -1 : 1));

        for (const row of rows) {
            let ok = false;
            let errorMsg = 'emit devolvió false (ver logs de Kafka)';
            try {
                // emit no lanza: devuelve false si falla. El id del outbox viaja como eventId.
                ok = await this.kafkaProducer.emit(row.topic, row.eventType, row.payload, row.key, row.id);
            } catch (error: any) {
                errorMsg = error?.message ?? String(error);
            }

            if (ok) await this.markSent(row.id);
            else await this.markRetry(row, errorMsg);
        }
    }

    /**
     * Reclama filas con un "arriendo" (corre next_attempt_at hacia adelante) para que
     * dos despachadores no tomen la misma. Respeta el orden por key: no toma una fila
     * si existe otra PENDING anterior (menor seq) con la misma key.
     */
    private async claim(limit: number, ids?: string[]): Promise<ClaimedRow[]> {
        const res: any = await this.dataSource.query(
            `UPDATE outbox_events o
                SET next_attempt_at = now() + ($3 || ' seconds')::interval
              WHERE o.id IN (
                    SELECT e.id
                      FROM outbox_events e
                     WHERE e.status = $4
                       AND e.next_attempt_at <= now()
                       AND ($2::uuid[] IS NULL OR e.id = ANY($2::uuid[]))
                       AND NOT EXISTS (
                             SELECT 1 FROM outbox_events p
                              WHERE p.key = e.key AND p.status = $4 AND p.seq < e.seq)
                     ORDER BY e.seq ASC
                     LIMIT $1
                       FOR UPDATE SKIP LOCKED)
          RETURNING o.id, o.seq, o.topic, o.event_type, o.key, o.payload, o.attempts`,
            [limit, ids?.length ? ids : null, String(LEASE_SECONDS), OutboxStatus.PENDING],
        );

        // En Postgres, UPDATE ... RETURNING puede venir como [filas, cantidad] o como filas
        const raw: any[] = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : res;
        return raw.map((r) => ({
            id: r.id,
            seq: String(r.seq),
            topic: r.topic,
            eventType: r.event_type,
            key: r.key,
            payload: r.payload,
            attempts: Number(r.attempts),
        }));
    }

    private async markSent(id: string) {
        await this.dataSource.query(
            `UPDATE outbox_events SET status = $2, sent_at = now(), last_error = NULL WHERE id = $1`,
            [id, OutboxStatus.SENT],
        );
    }

    private async markRetry(row: ClaimedRow, error: string) {
        const delay = Math.min(BASE_BACKOFF_MS * 2 ** Math.min(row.attempts, 8), MAX_BACKOFF_MS);
        console.warn(`⚠️ [Outbox] ${row.eventType} ${row.key} falló (intento ${row.attempts + 1}); reintento en ${Math.round(delay / 1000)}s`);
        await this.dataSource.query(
            `UPDATE outbox_events
                SET attempts = attempts + 1,
                    next_attempt_at = $2,
                    last_error = $3
              WHERE id = $1`,
            [row.id, new Date(Date.now() + delay), error.slice(0, 1000)],
        );
    }
}