// src/order-validation/order-validation.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderValidation, OrderValidationDocument } from './schemas/order-validation.schema';
import { OrderReplica, OrderReplicaDocument } from '../orders-relay/schemas/order-replica.schema';
import { RpcException } from '@nestjs/microservices';
import { UserEmployeeCache, UserEmployeeCacheDocument } from '../users-employees-events/schemas/user-employee-cache.schema';
import { BroadcastService } from '../broadcast/broadcast.service';

const ENTREGADA_STATUS_ID = 8;
const DEFAULT_TIMEZONE = 'America/Guayaquil';

@Injectable()
export class OrderValidationService implements OnModuleInit {
    private readonly logger = new Logger(OrderValidationService.name);

    constructor(
        @InjectModel(OrderValidation.name)
        private readonly validationModel: Model<OrderValidationDocument>,

        @InjectModel(OrderReplica.name)
        private readonly orderReplicaModel: Model<OrderReplicaDocument>,

        @InjectModel(UserEmployeeCache.name)
        private readonly userCacheModel: Model<UserEmployeeCacheDocument>,

        private readonly broadcastService: BroadcastService,
    ) { }
    async findValidationsForSync(fromCache: Date | null): Promise<{ order_id: number; is_checked: boolean; updatedAt: Date }[]> {
        const filter = fromCache
            ? { updatedAt: { $gt: new Date(fromCache) } }
            : {};

        const results = await this.validationModel
            .find(filter)
            .select('order_id is_checked updatedAt')
            .sort({ updatedAt: 1 })
            .lean<{ order_id: number; is_checked: boolean; updatedAt: Date }[]>()
            .exec();

        return results;
    }

    // ─── Lifecycle Hook ───────────────────────────────────────────────────────

    async onModuleInit(): Promise<void> {
        await this.seedDeliveredOrderValidations();
    }

    // ─── Seed ─────────────────────────────────────────────────────────────────

    /**
     * Busca todas las órdenes en estado ENTREGADA (id=8) y crea el registro
     * de validación para las que aún no lo tengan.
     * Se ejecuta una única vez al arrancar el módulo.
     * El seed NO publica eventos Kafka — son datos históricos, no eventos nuevos.
     */
    private async seedDeliveredOrderValidations(): Promise<void> {
        this.logger.log('Verificando validaciones pendientes de órdenes ENTREGADAS...');

        const deliveredOrders = await this.orderReplicaModel
            .find({ 'currentStatus.id': ENTREGADA_STATUS_ID })
            .select('id statusHistory')
            .lean<{ id: number; statusHistory: { toStatus: { id: number }; changed_at: Date }[] }[]>()
            .exec();

        if (!deliveredOrders.length) {
            this.logger.log('No hay órdenes ENTREGADAS. Nada que seed.');
            return;
        }

        const allOrderIds = deliveredOrders.map((o) => o.id);

        const existingIds = new Set(
            (
                await this.validationModel
                    .find({ order_id: { $in: allOrderIds } })
                    .select('order_id')
                    .lean<{ order_id: number }[]>()
                    .exec()
            ).map((v) => v.order_id),
        );

        const pending = deliveredOrders.filter((o) => !existingIds.has(o.id));

        if (!pending.length) {
            this.logger.log('Todas las órdenes ENTREGADAS ya tienen validación. Sin cambios.');
            return;
        }

        this.logger.log(`Creando validaciones para ${pending.length} orden(es)...`);

        const groupsByDate = new Map<string, typeof pending>();

        for (const order of pending) {
            const deliveredEntry = [...(order.statusHistory ?? [])]
                .reverse()
                .find((h) => h.toStatus?.id === ENTREGADA_STATUS_ID);

            const deliveredAt = deliveredEntry?.changed_at ?? new Date();
            const dateKey = this.toDateKey(deliveredAt);

            if (!groupsByDate.has(dateKey)) groupsByDate.set(dateKey, []);
            groupsByDate.get(dateKey)!.push(order);
        }

        const dateKeys = [...groupsByDate.keys()];

        const maxSeqResults = await this.validationModel.aggregate<{
            _id: string;
            maxSeq: number;
        }>([
            { $match: { validation_date_key: { $in: dateKeys } } },
            { $group: { _id: '$validation_date_key', maxSeq: { $max: '$daily_sequential' } } },
        ]);

        const maxSeqByDate = new Map(maxSeqResults.map((r) => [r._id, r.maxSeq]));

        const docs: Partial<OrderValidation>[] = [];

        for (const [dateKey, orders] of groupsByDate) {
            let seq = maxSeqByDate.get(dateKey) ?? 0;

            for (const order of orders) {
                seq++;
                docs.push({
                    order_id: order.id,
                    daily_sequential: seq,
                    validation_date_key: dateKey,
                    is_checked: false,
                    history: [],
                });
            }
        }

        const result = await this.validationModel.insertMany(docs, { ordered: false });

        this.logger.log(`✔ ${result.length} validación(es) creadas correctamente.`);
        // ✅ Publicar evento por cada validación creada en el seed —
        // el registro es nuevo independientemente de cuándo se entregó la orden.
        await Promise.all(
            docs.map((doc) =>
                this.broadcastService.publishValidationCreated({
                    order_id: doc.order_id!,
                    daily_sequential: doc.daily_sequential!,
                    validation_date_key: doc.validation_date_key!,
                }),
            ),
        );
    }

    // ─── Create ───────────────────────────────────────────────────────────────

    async createForDeliveredOrder(orderId: number): Promise<void> {
        const dateKey = this.toDateKey(new Date());

        const last = await this.validationModel
            .findOne({ validation_date_key: dateKey })
            .sort({ daily_sequential: -1 })
            .select('daily_sequential')
            .lean<{ daily_sequential: number }>()
            .exec();

        const nextSeq = (last?.daily_sequential ?? 0) + 1;

        try {
            await this.validationModel.create({
                order_id: orderId,
                daily_sequential: nextSeq,
                validation_date_key: dateKey,
                is_checked: false,
                history: [],
            });

            this.logger.log(`Validación creada | orden ${orderId} | ${dateKey} | #${nextSeq}`);

            // ✅ Publicar evento — orden recién entregada, validación nueva
            await this.broadcastService.publishValidationCreated({
                order_id: orderId,
                daily_sequential: nextSeq,
                validation_date_key: dateKey,
            });

        } catch (err: any) {
            if (err?.code === 11000) {
                this.logger.warn(`Validación ya existente para orden ${orderId}, se omite.`);
                return;
            }
            throw err;
        }
    }

    // ─── Toggle ───────────────────────────────────────────────────────────────

    async toggleIsChecked(
        validationId: string,
        isChecked: boolean,
        user: { sub: string; companyId: string },
    ): Promise<OrderValidationDocument> {

        const [doc, userCache] = await Promise.all([
            this.validationModel.findById(validationId),
            this.userCacheModel.findOne({ id: user.sub }).lean(),
        ]);

        if (!doc) {
            throw new RpcException({ status: 404, message: `Validation ${validationId} not found` });
        }

        if (!userCache) {
            throw new RpcException({ status: 404, message: `User ${user.sub} not found in cache` });
        }

        const performer = {
            id: userCache.id,
            username: userCache.username,
            first_name: userCache.first_name,
            last_name: userCache.last_name ?? '',
        };

        doc.is_checked = isChecked;
        doc.history.push({
            status_snapshot: isChecked,
            performed_by: performer,
            timestamp: new Date(),
        });

        const saved = await doc.save();

        // ✅ Publicar evento — alguien marcó/desmarcó la validación
        await this.broadcastService.publishValidationUpdated({
            validation_id: validationId,
            order_id: doc.order_id,
            is_checked: isChecked,
            performed_by: performer,
            timestamp: new Date().toISOString(),
        });

        return saved;
    }

    // ─── Query ────────────────────────────────────────────────────────────────

    async getOrderValidationStatus(id: string) {
        const orderId = Number(id);

        const validation = await this.validationModel
            .findOne({ order_id: orderId })
            .select('_id is_checked')
            .lean()
            .exec();

        if (!validation) {
            return { found: false, is_validated: false };
        }

        return {
            found: true,
            id: validation._id.toString(),
            is_validated: validation.is_checked,
        };
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private toDateKey(date: Date, tz: string = DEFAULT_TIMEZONE): string {
        return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(date);
    }
}