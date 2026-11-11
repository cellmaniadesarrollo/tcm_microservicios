import { Column, CreateDateColumn, Entity, Generated, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum OutboxStatus {
    PENDING = 'PENDING',
    SENT = 'SENT',
    FAILED = 'FAILED', // solo se marca a mano; el despachador nunca descarta
}

/**
 * Evento pendiente de publicar en Kafka. Se inserta DENTRO de la transacción
 * del documento que lo origina, así que "documento guardado" y "evento
 * registrado" son atómicos. Un despachador lo publica después del commit.
 *
 * seq  -> orden global de inserción (el despachador respeta el orden por key).
 * key  -> key de Kafka (p. ej. id de la línea del vale). Misma key = mismo orden.
 */
@Entity('outbox_events')
@Index('idx_outbox_status_next', ['status', 'nextAttemptAt'])
@Index('idx_outbox_key_seq', ['key', 'seq'])
@Index('idx_outbox_company', ['companyId'])
export class OutboxEvent {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'bigint', update: false })
    @Generated('increment')
    seq!: string; // bigint llega como string

    @Column({ name: 'company_id', type: 'uuid' })
    companyId!: string;

    @Column({ length: 150 })
    topic!: string;

    @Column({ name: 'event_type', length: 100 })
    eventType!: string;

    @Column({ length: 100 })
    key!: string;

    // any: QueryDeepPartialEntity no acepta Record<string, unknown> en columnas jsonb
    @Column({ type: 'jsonb' })
    payload!: any;

    // varchar (no enum de Postgres) para no depender de ALTER TYPE si se agregan estados
    @Column({ type: 'varchar', length: 20, default: OutboxStatus.PENDING })
    status!: OutboxStatus;

    @Column({ type: 'int', default: 0 })
    attempts!: number;

    @Column({ name: 'next_attempt_at', type: 'timestamptz', default: () => 'now()' })
    nextAttemptAt!: Date;

    @Column({ name: 'last_error', type: 'text', nullable: true })
    lastError?: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt!: Date;

    @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
    sentAt?: Date | null;
}