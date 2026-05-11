// src/orders-relay/orders-relay.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderReplica } from './entities/order-replica.entity';
import { OrderStatus } from './entities/order-status.entity';
import { OrderType } from './entities/order-type.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrdersRelayService {
    private readonly logger = new Logger(OrdersRelayService.name);
    constructor(
        @InjectRepository(OrderReplica)
        private readonly orderRepo: Repository<OrderReplica>,
        @InjectRepository(OrderStatus)
        private readonly orderStatusRepo: Repository<OrderStatus>,
        @InjectRepository(OrderType)
        private readonly orderTypeRepo: Repository<OrderType>,
        private readonly notifications: NotificationsService,
    ) { }

    // ── Última actualización para sync incremental ─────────────────────────────
    async getLastUpdatedAt(): Promise<Date | null> {
        const result = await this.orderRepo
            .createQueryBuilder('o')
            .select('o.remoteUpdatedAt')
            .where('o.remoteUpdatedAt IS NOT NULL')
            .orderBy('o.remoteUpdatedAt', 'DESC')
            .getOne();

        return result?.remoteUpdatedAt ?? null;
    }

    // ── Sync individual desde Kafka ────────────────────────────────────────────
    async syncOrder(data: any): Promise<void> {
        const mapped = this.mapPayloadToEntity(data);

        await this.orderRepo
            .createQueryBuilder()
            .insert()
            .into(OrderReplica)
            .values(mapped)
            .orUpdate(
                [
                    'public_id',
                    'order_number',
                    'customer_id',
                    'device_id', 'device_label', 'device_brand', 'device_model',
                    'status_id', 'status_name', 'status_history',
                    'type_id', 'type_name',
                    'remote_created_at', 'remote_updated_at',
                ],
                ['id'],
            )
            .execute();

        console.log(`🧾 Order ${data.id} sincronizada`);
        // Notificar creación — fire and forget, no bloquea el sync
        this.notifications.handleOrderCreated(data.id).catch((err) =>
            this.logger.error(`Error notificando creación orden ${data.id}: ${err?.message}`),
        );
    }

    // ── Sync masiva ────────────────────────────────────────────────────────────
    async syncOrdersBulk(orders: any[]): Promise<void> {
        if (!orders?.length) return;

        const CHUNK_SIZE = 200;
        let upserted = 0;

        for (let i = 0; i < orders.length; i += CHUNK_SIZE) {
            const chunk = orders.slice(i, i + CHUNK_SIZE);
            const mapped = chunk.map((o) => this.mapPayloadToEntity(o));

            try {
                await this.orderRepo
                    .createQueryBuilder()
                    .insert()
                    .into(OrderReplica)
                    .values(mapped)
                    .orUpdate(
                        [
                            'public_id',
                            'order_number',
                            'customer_id',
                            'device_id', 'device_label', 'device_brand', 'device_model',
                            'status_id', 'status_name', 'status_history',
                            'type_id', 'type_name',
                            'remote_created_at', 'remote_updated_at',
                        ],
                        ['id'],
                    )
                    .execute();

                upserted += chunk.length;
            } catch (error: any) {
                console.error(`❌ Error en chunk [${i}–${i + chunk.length}]:`, error.message);
            }
        }

        console.log(`✅ Sync órdenes OK | Procesadas: ${upserted}/${orders.length}`);
    }

    // ── Aplicar actualizaciones parciales desde Kafka ──────────────────────────
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
                const order = await this.orderRepo.findOne({ where: { id: orderId } });
                if (!order) break;

                const newStatusId = payload.currentStatus.id;

                order.statusId = newStatusId;
                order.statusName = payload.currentStatus.name;
                order.remoteUpdatedAt = ts;

                if (payload.statusHistoryEntry) {
                    order.statusHistory = [
                        ...(order.statusHistory ?? []),
                        payload.statusHistoryEntry,
                    ];
                }

                await this.orderRepo.save(order);

                // Notificar cambio de estado — fire and forget
                this.notifications.handleStatusChanged(orderId, payload.currentStatus.name).catch((err) =>
                    this.logger.error(`Error notificando estado orden ${orderId}: ${err?.message}`),
                );
                break;
            }

            case 'note_added':
            case 'note_updated':
            case 'note_deleted':
            case 'payment_added':
            case 'finding_added':
            case 'finding_updated':
            case 'finding_deleted':
            case 'procedure_added':
            case 'procedure_updated':
            case 'procedure_deleted':
            case 'attachment_added':
            case 'attachment_deleted':
                await this.orderRepo.update({ id: orderId }, { remoteUpdatedAt: ts });
                break;

            default:
                this.logger.warn(`⚠️ changed_scope desconocido: ${scope} | order: ${orderId}`);
        }
    }


    // ── Checksum ───────────────────────────────────────────────────────────────
    async isAlreadySynced(remoteStatuses: any[], remoteTypes: any[]): Promise<boolean> {
        const [localStatusCount, localTypeCount] = await Promise.all([
            this.orderStatusRepo.count(),
            this.orderTypeRepo.count(),
        ]);

        const inSync =
            localStatusCount === remoteStatuses.length &&
            localTypeCount === remoteTypes.length;

        console.log(
            `📊 Checksum | Statuses: local=${localStatusCount} remote=${remoteStatuses.length} | ` +
            `Types: local=${localTypeCount} remote=${remoteTypes.length} | ` +
            `inSync=${inSync}`,
        );

        return inSync;
    }

    // ── Sync bulk catálogos ────────────────────────────────────────────────────
    private async bulkUpsertCatalog<T extends { id: number }>(
        repo: Repository<any>,
        records: T[],
        updateColumns: string[],
        label: string,
    ): Promise<void> {
        if (!records?.length) return;

        const CHUNK_SIZE = 100;

        for (let i = 0; i < records.length; i += CHUNK_SIZE) {
            const chunk = records.slice(i, i + CHUNK_SIZE);

            await repo
                .createQueryBuilder()
                .insert()
                .into(repo.target)
                .values(chunk)
                .orUpdate(updateColumns, ['id'])
                .execute();
        }

        console.log(`✅ Sync ${label} | Total: ${records.length}`);
    }

    // ── Normalizations ─────────────────────────────────────────────────────────
    async syncNormalizations(data: {
        orderStatuses: any[];
        orderTypes: any[];
    }): Promise<void> {
        const { orderStatuses, orderTypes } = data;

        const alreadySynced = await this.isAlreadySynced(orderStatuses, orderTypes);
        if (alreadySynced) {
            console.log('✅ Normalizaciones ya sincronizadas, skip.');
            return;
        }

        await Promise.all([
            this.bulkUpsertCatalog(this.orderStatusRepo, orderStatuses, ['name', 'color'], 'OrderStatuses'),
            this.bulkUpsertCatalog(this.orderTypeRepo, orderTypes, ['name', 'description'], 'OrderTypes'),
        ]);
    }

    // ── Mapper: payload real → entidad Postgres ────────────────────────────────
    // ── Mapper: payload real → entidad Postgres ────────────────────────────────
    // mapPayloadToEntity: eliminar toda la lógica de contactos
    private mapPayloadToEntity(data: any): Partial<OrderReplica> {
        return {
            id: data.id,
            publicId: data.public_id,           // ← UUID real
            orderNumber: data.order_number,        // ← número legible

            // ── Cliente: solo FK ───────────────────────────────────────────────
            customerId: data.customer?.id,

            // ── Dispositivo ────────────────────────────────────────────────────
            deviceId: data.device?.device_id,
            deviceLabel: data.device?.model
                ? `${data.device.model.brand_name ?? ''} ${data.device.model.models_name ?? ''}`.trim()
                : undefined,
            deviceBrand: data.device?.model?.brand_name,
            deviceModel: data.device?.model?.models_name,

            // ── Estado ─────────────────────────────────────────────────────────
            statusId: data.currentStatus?.id,
            statusName: data.currentStatus?.name,
            statusHistory: data.statusHistory ?? [],

            // ── Tipo ───────────────────────────────────────────────────────────
            typeId: data.type?.id,
            typeName: data.type?.name,

            // ── Timestamps ─────────────────────────────────────────────────────
            remoteCreatedAt: data.createdAt ? new Date(data.createdAt) : undefined,
            remoteUpdatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
        };
    }
}