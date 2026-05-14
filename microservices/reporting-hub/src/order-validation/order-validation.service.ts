import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderValidation, OrderValidationDocument } from './schemas/order-validation.schema';
import { OrderReplica, OrderReplicaDocument } from '../orders-relay/schemas/order-replica.schema';
import { RpcException } from '@nestjs/microservices';
import { UserEmployeeCache, UserEmployeeCacheDocument } from '../users-employees-events/schemas/user-employee-cache.schema';

const ENTREGADA_STATUS_ID = 8;

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
    ) { }

    // ─── Lifecycle Hook ───────────────────────────────────────────────────────

    async onModuleInit(): Promise<void> {
        await this.seedDeliveredOrderValidations();
    }

    // ─── Seed ─────────────────────────────────────────────────────────────────

    /**
     * Busca todas las órdenes en estado ENTREGADA (id=8) y crea el registro
     * de validación para las que aún no lo tengan.
     * Se ejecuta una única vez al arrancar el módulo.
     */
    private async seedDeliveredOrderValidations(): Promise<void> {
        this.logger.log('Verificando validaciones pendientes de órdenes ENTREGADAS...');

        // 1. Traer id + statusHistory para extraer la fecha real de entrega
        const deliveredOrders = await this.orderReplicaModel
            .find({ 'currentStatus.id': ENTREGADA_STATUS_ID })
            .select('id statusHistory')
            .lean<{ id: number; statusHistory: { toStatus: { id: number }; changed_at: Date }[] }[]>()
            .exec();

        if (!deliveredOrders.length) {
            this.logger.log('No hay órdenes ENTREGADAS. Nada que seed.');
            return;
        }

        // 2. Filtrar las que ya tienen validación
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

        // 3. Agrupar por fecha de entrega real (último cambio a ENTREGADA en statusHistory)
        //    Si por alguna razón no tiene historial, cae en el día de hoy
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

        // 4. Obtener el máximo sequential existente por fecha (seed puede correr parcialmente)
        const dateKeys = [...groupsByDate.keys()];

        const maxSeqResults = await this.validationModel.aggregate<{
            _id: string;
            maxSeq: number;
        }>([
            { $match: { validation_date_key: { $in: dateKeys } } },
            { $group: { _id: '$validation_date_key', maxSeq: { $max: '$daily_sequential' } } },
        ]);

        const maxSeqByDate = new Map(maxSeqResults.map((r) => [r._id, r.maxSeq]));

        // 5. Construir documentos respetando el orden dentro de cada día
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

        // 6. Bulk insert
        const result = await this.validationModel.insertMany(docs, { ordered: false });

        this.logger.log(`✔ ${result.length} validación(es) creadas correctamente.`);
    }


    /**
 * Crea el registro de validación cuando una orden pasa a estado ENTREGADA.
 * Si ya existe (reintento de evento), simplemente lo ignora.
 */
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
        } catch (err: any) {
            if (err?.code === 11000) {
                this.logger.warn(`Validación ya existente para orden ${orderId}, se omite.`);
                return;
            }
            throw err;
        }
    }

    private toDateKey(date: Date): string {
        return date.toISOString().slice(0, 10);
    }


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

        doc.is_checked = isChecked;
        doc.history.push({
            status_snapshot: isChecked,
            performed_by: {
                id: userCache.id,
                username: userCache.username,
                first_name: userCache.first_name,
                last_name: userCache.last_name ?? '',
            },
            timestamp: new Date(),
        });

        return doc.save();
    }
}