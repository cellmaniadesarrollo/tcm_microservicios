import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { Repository } from 'typeorm';
import { OrderReplica } from './entities/order-replica.entity';
import { toDeviceColumns, toOrderReplica } from './mappers/order-replica.mapper';
import { ORDER_STATUSES_BLOCK_ISSUE } from '../stock-vouchers/enums/stock-voucher.enums';

const BULK_CHUNK_SIZE = 500; // 17 columnas x 500 = 8500 params (límite PG: 65535)
const SEARCH_LIMIT = 20;
// Solo pisa si lo que llega es igual o más nuevo que lo guardado.
// Protege contra eventos atrasados (Kafka vs bulk de Rabbit en paralelo).
const OVERWRITE_IF_NEWER = `
    orders_replica.source_updated_at IS NULL
    OR EXCLUDED.source_updated_at IS NULL
    OR orders_replica.source_updated_at <= EXCLUDED.source_updated_at
`;

const UPSERT_COLUMNS = [
    'order_number',
    'company_id',
    'status_id',
    'status_name',
    'customer_id',
    'customer_name',
    'order_type_id',
    'order_type_name',
    'device_id',
    'device_brand',
    'device_model',
    'device_type',
    'device_serial',
    'device_imeis',
    'source_created_at',
    'source_updated_at',
];

@Injectable()
export class OrdersRelayService {
    private readonly logger = new Logger(OrdersRelayService.name);

    constructor(
        @InjectRepository(OrderReplica)
        private readonly orderRepo: Repository<OrderReplica>,
    ) { }

    // ── Checkpoint para el sync incremental ──────────────────────
    async getLastUpdatedAt(): Promise<Date | null> {
        const row = await this.orderRepo
            .createQueryBuilder('o')
            .select('MAX(o.source_updated_at)', 'max')
            .getRawOne<{ max: string | null }>();

        return row?.max ? new Date(row.max) : null;
    }

    // ── Upsert (compartido por Kafka created y bulk) ─────────────
    private async upsertMany(rows: OrderReplica[]): Promise<void> {
        if (!rows.length) return;

        await this.orderRepo
            .createQueryBuilder()
            .insert()
            .into(OrderReplica)
            .values(rows)
            .orUpdate(UPSERT_COLUMNS, ['id'], {
                overwriteCondition: { where: OVERWRITE_IF_NEWER },
            })
            .execute();
    }

    // ── Kafka: order.created ─────────────────────────────────────
    async syncOrder(data: any): Promise<void> {
        await this.upsertMany([toOrderReplica(data)]);
        this.logger.log(`🧾 Order ${data.id} (#${data.order_number}) sincronizada`);
    }

    // ── Rabbit: bulk / reconciliación ────────────────────────────
    async syncOrdersBulk(orders: any[]): Promise<void> {
        if (!orders?.length) return;

        // Dedupe por id (último gana): Postgres falla con
        // "ON CONFLICT DO UPDATE command cannot affect row a second time"
        const byId = new Map<number, OrderReplica>();
        for (const order of orders) {
            try {
                byId.set(order.id, toOrderReplica(order));
            } catch (err: any) {
                this.logger.error(`❌ Orden ${order?.id} no mapeable: ${err.message}`);
            }
        }
        const rows = [...byId.values()];

        let ok = 0;
        for (let i = 0; i < rows.length; i += BULK_CHUNK_SIZE) {
            const chunk = rows.slice(i, i + BULK_CHUNK_SIZE);
            try {
                await this.upsertMany(chunk);
                ok += chunk.length;
            } catch (err: any) {
                this.logger.error(
                    `❌ Lote ${i}-${i + chunk.length} falló: ${err.message} ` +
                    `| ids: ${chunk[0].id}..${chunk[chunk.length - 1].id}`,
                );
            }
        }

        this.logger.log(`✅ Sync órdenes | recibidas: ${orders.length} | procesadas: ${ok}/${rows.length}`);
    }

    // ── Kafka: order.updated ─────────────────────────────────────
    async applyUpdate(
        orderId: number,
        scope: string,
        payload: any,
        updatedAt: string,
    ): Promise<void> {
        const ts = new Date(updatedAt);

        switch (scope) {
            case 'status_changed':
            case 'closed': {
                const result = await this.orderRepo
                    .createQueryBuilder()
                    .update(OrderReplica)
                    .set({
                        status_id: payload.currentStatus.id,
                        status_name: payload.currentStatus.name,
                        source_updated_at: ts,
                    })
                    .where('id = :id', { id: orderId })
                    .andWhere('(source_updated_at IS NULL OR source_updated_at <= :ts)', { ts })
                    .execute();

                if (!result.affected) {
                    this.logger.debug(
                        `Orden ${orderId} no actualizada (no existe aún o evento atrasado)`,
                    );
                }
                break;
            }

            case 'device_updated': {
                const result = await this.orderRepo
                    .createQueryBuilder()
                    .update(OrderReplica)
                    .set({ ...toDeviceColumns(payload.device), source_updated_at: ts })
                    .where('id = :id', { id: orderId })
                    .andWhere('(source_updated_at IS NULL OR source_updated_at <= :ts)', { ts })
                    .execute();

                if (!result.affected) {
                    this.logger.debug(
                        `Orden ${orderId} no actualizada (no existe aún o evento atrasado)`,
                    );
                }
                break;
            }

            // Scopes que esta réplica no necesita: se ignoran a propósito.
            // NO se avanza source_updated_at para no mover el checkpoint
            // por encima de cambios que sí podríamos haber perdido.
            default:
                this.logger.debug(`Scope ignorado: ${scope} | order: ${orderId}`);
                break;
        }
    }

    // ── Buscador para selects (sin paginación) ───────────────────


    async search(companyId: string, search?: string) {
        const raw = (search ?? '').trim().slice(0, 100);

        const qb = this.orderRepo
            .createQueryBuilder('o')
            .where('o.company_id = :companyId', { companyId });

        if (raw.startsWith('#')) {
            const digits = raw.slice(1).trim();
            if (!/^\d{1,9}$/.test(digits)) {
                throw new RpcException(
                    new BadRequestException('Número de orden inválido. Use el formato #123.'),
                );
            }
            qb.andWhere('o.order_number = :orderNumber', { orderNumber: Number(digits) });
        } else {
            qb.andWhere('o.status_id NOT IN (:...blocked)', {
                blocked: [...ORDER_STATUSES_BLOCK_ISSUE],
            });

            const tokens = raw
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 6)
                .map((t) => t.replace(/[\\%_]/g, '\\$&'));

            tokens.forEach((token, i) => {
                const p = `t${i}`;
                const fields = [
                    `o.customer_name ILIKE :${p}`,
                    `o.device_brand ILIKE :${p}`,
                    `o.device_model ILIKE :${p}`,
                ];
                if (token.length >= 6) {
                    fields.push(`o.device_serial ILIKE :${p}`, `o.device_imeis ILIKE :${p}`);
                }
                qb.andWhere(`(${fields.join(' OR ')})`, { [p]: `%${token}%` });
            });
        }

        const orders = await qb
            .orderBy('o.source_updated_at', 'DESC', 'NULLS LAST')
            .addOrderBy('o.id', 'DESC')
            .limit(SEARCH_LIMIT)
            .getMany();

        const blocked: number[] = [...ORDER_STATUSES_BLOCK_ISSUE];

        return orders.map((o) => ({
            id: o.id,
            orderNumber: o.order_number,
            customerName: o.customer_name,
            device: [o.device_brand, o.device_model].filter(Boolean).join(' ') || null,
            deviceType: o.device_type,
            orderType: o.order_type_name,
            status: { id: o.status_id, name: o.status_name },
            canIssue: !blocked.includes(o.status_id),
        }));
    }
} 