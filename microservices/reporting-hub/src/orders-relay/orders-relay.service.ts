import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderReplica, OrderReplicaDocument } from './schemas/order-replica.schema';
import { OrderStatus, OrderStatusDocument } from './schemas/order-status.schema';
import { OrderType, OrderTypeDocument } from './schemas/order-type.schema';

@Injectable()
export class OrdersRelayService {
    constructor(
        @InjectModel(OrderReplica.name)
        private readonly orderModel: Model<OrderReplicaDocument>,
        @InjectModel(OrderStatus.name)
        private readonly orderStatusModel: Model<OrderStatusDocument>,
        @InjectModel(OrderType.name)
        private readonly orderTypeModel: Model<OrderTypeDocument>,
    ) { }
    async getLastUpdatedAt(): Promise<Date | null> {
        const result = await this.orderModel
            .findOne({ updatedAt: { $ne: null } })
            .sort({ updatedAt: -1 })
            .select('updatedAt')
            .lean();
        return result?.updatedAt ?? null;
    }

    // ── Sync individual desde Kafka ───────────────────────────────────────────
    async syncOrder(data: any): Promise<void> {
        await this.orderModel.findOneAndUpdate(
            { id: data.id },
            { $set: data },          // el payload ya viene con el shape del schema
            { upsert: true, new: true },
        );
        console.log(`🧾 Order ${data.id} (${data.public_id}) sincronizada`);
    }

    // ── Sync masiva ───────────────────────────────────────────────────────────
    async syncOrdersBulk(orders: any[]): Promise<void> {
        if (!orders?.length) return;

        const operations = orders.map((order) => ({
            updateOne: {
                filter: { id: order.id },
                update: { $set: order },
                upsert: true,
            },
        }));

        try {
            const result = await this.orderModel.bulkWrite(operations, { ordered: false });

            console.log(
                `✅ Sync órdenes OK | Upserted: ${result.upsertedCount} | Modified: ${result.modifiedCount}`,
            );
        } catch (error: any) {
            // MongoBulkWriteError contiene los detalles de cada fallo
            if (error.writeErrors) {
                console.error(`\n❌ Se encontraron ${error.writeErrors.length} errores de duplicidad.`);

                error.writeErrors.forEach((err: any) => {
                    const failedOrder = orders[err.index]; // Accedemos al JSON original usando el índice del error

                    console.error(`--- ERROR EN ÍNDICE ${err.index} ---`);
                    console.error(`Mensaje Mongo: ${err.errmsg}`);
                    console.error(`JSON enviado a DB:`, JSON.stringify(failedOrder, null, 2));
                    console.error(`---------------------------------\n`);
                });
            } else {
                console.error("❌ Error crítico en bulkWrite:", error);
            }
        }
    }
    async applyUpdate(
        orderId: number,
        scope: string,
        payload: any,
        updatedAt: string,
    ): Promise<void> {
        const ts = new Date(updatedAt);

        switch (scope) {

            // ── Estado ──────────────────────────────────────────────────────────────
            case 'status_changed':
            case 'closed':
                await this.orderModel.findOneAndUpdate(
                    { id: orderId },
                    { $set: { 'currentStatus.id': payload.currentStatus.id, updatedAt: ts } },
                );
                break;

            // ── Notas ────────────────────────────────────────────────────────────────
            case 'note_added':
                await this.orderModel.findOneAndUpdate(
                    { id: orderId },
                    {
                        $push: { notes: payload.note },
                        $set: { updatedAt: ts },
                    },
                );
                break;

            case 'note_updated':
                await this.orderModel.findOneAndUpdate(
                    { id: orderId, 'notes.id': payload.note_id },
                    {
                        $set: {
                            'notes.$[note].note': payload.note,
                            'notes.$[note].is_public': payload.is_public,
                            'notes.$[note].updatedAt': new Date(payload.updatedAt),
                            updatedAt: ts,
                        },
                    },
                    { arrayFilters: [{ 'note.id': payload.note_id }] },
                );
                break;

            case 'note_deleted':
                await this.orderModel.findOneAndUpdate(
                    { id: orderId, 'notes.id': payload.note_id },
                    {
                        $set: {
                            'notes.$[note].isDeleted': true,
                            'notes.$[note].deletedAt': payload.deletedAt,
                            updatedAt: ts,
                        },
                    },
                    { arrayFilters: [{ 'note.id': payload.note_id }] },
                );
                break;

            // ── Pagos ────────────────────────────────────────────────────────────────
            case 'payment_added':
                await this.orderModel.findOneAndUpdate(
                    { id: orderId },
                    {
                        $push: { payments: payload.payment },
                        $set: { updatedAt: ts },
                    },
                );
                break;

            // ── Findings ─────────────────────────────────────────────────────────────
            case 'finding_added':
                await this.orderModel.findOneAndUpdate(
                    { id: orderId },
                    {
                        $push: { findings: payload.finding },
                        $set: { updatedAt: ts },
                    },
                );
                break;

            case 'finding_updated':
                await this.orderModel.findOneAndUpdate(
                    { id: orderId, 'findings.id': payload.finding_id },
                    {
                        $set: {
                            'findings.$[f].description': payload.description,
                            'findings.$[f].is_active': payload.is_active,
                            'findings.$[f].is_resolved': payload.is_resolved,
                            'findings.$[f].updatedAt': new Date(payload.updatedAt),
                            updatedAt: ts,
                        },
                    },
                    { arrayFilters: [{ 'f.id': payload.finding_id }] },
                );
                break;

            case 'finding_deleted':
                await this.orderModel.findOneAndUpdate(
                    { id: orderId, 'findings.id': payload.finding_id },
                    {
                        $set: {
                            'findings.$[f].is_active': false,
                            updatedAt: ts,
                        },
                    },
                    { arrayFilters: [{ 'f.id': payload.finding_id }] },
                );
                break;

            // ── Procedures ───────────────────────────────────────────────────────────
            case 'procedure_added':
                await this.orderModel.findOneAndUpdate(
                    { id: orderId, 'findings.id': payload.finding_id },
                    {
                        $push: { 'findings.$[f].procedures': payload.procedure },
                        $set: { updatedAt: ts },
                    },
                    { arrayFilters: [{ 'f.id': payload.finding_id }] },
                );
                break;

            case 'procedure_updated':
                await this.orderModel.findOneAndUpdate(
                    { id: orderId },
                    {
                        $set: {
                            'findings.$[f].procedures.$[p].description': payload.description,
                            'findings.$[f].procedures.$[p].is_active': payload.is_active,
                            'findings.$[f].procedures.$[p].is_public': payload.is_public,
                            'findings.$[f].procedures.$[p].time_spent_minutes': payload.time_spent_minutes,
                            'findings.$[f].procedures.$[p].procedure_cost': payload.procedure_cost,
                            'findings.$[f].procedures.$[p].warranty_days': payload.warranty_days,
                            'findings.$[f].procedures.$[p].client_approved': payload.client_approved,
                            'findings.$[f].procedures.$[p].was_solved': payload.was_solved,
                            'findings.$[f].procedures.$[p].requires_followup': payload.requires_followup,
                            'findings.$[f].procedures.$[p].followup_notes': payload.followup_notes,
                            'findings.$[f].procedures.$[p].updatedAt': new Date(payload.updatedAt),
                            updatedAt: ts,
                        },
                    },
                    { arrayFilters: [{ 'f.id': payload.finding_id }, { 'p.id': payload.procedure_id }] },
                );
                break;

            case 'procedure_deleted':
                await this.orderModel.findOneAndUpdate(
                    { id: orderId },
                    {
                        $set: {
                            'findings.$[f].procedures.$[p].is_active': false,
                            updatedAt: ts,
                        },
                    },
                    { arrayFilters: [{ 'f.id': payload.finding_id }, { 'p.id': payload.procedure_id }] },
                );
                break;

            // ── Attachments ──────────────────────────────────────────────────────────
            case 'attachment_added':
                if (payload.entity_type === 'ORDER') {
                    await this.orderModel.findOneAndUpdate(
                        { id: orderId },
                        {
                            $push: { attachments: { $each: payload.attachments } },
                            $set: { updatedAt: ts },
                        },
                    );
                } else if (payload.entity_type === 'FINDING') {
                    await this.orderModel.findOneAndUpdate(
                        { id: orderId },
                        {
                            $push: { 'findings.$[f].attachments': { $each: payload.attachments } },
                            $set: { updatedAt: ts },
                        },
                        { arrayFilters: [{ 'f.id': payload.finding_id }] },
                    );
                } else if (payload.entity_type === 'PROCEDURE') {
                    await this.orderModel.findOneAndUpdate(
                        { id: orderId },
                        {
                            $push: { 'findings.$[f].procedures.$[p].attachments': { $each: payload.attachments } },
                            $set: { updatedAt: ts },
                        },
                        { arrayFilters: [{ 'f.id': payload.finding_id }, { 'p.id': payload.procedure_id }] },
                    );
                }
                break;

            case 'attachment_deleted':
                if (payload.entity_type === 'ORDER') {
                    await this.orderModel.findOneAndUpdate(
                        { id: orderId, 'attachments.id': payload.attachment_id },
                        {
                            $set: {
                                'attachments.$[a].is_active': false,
                                updatedAt: ts,
                            },
                        },
                        { arrayFilters: [{ 'a.id': payload.attachment_id }] },
                    );
                } else if (payload.entity_type === 'FINDING') {
                    await this.orderModel.findOneAndUpdate(
                        { id: orderId },
                        {
                            $set: {
                                'findings.$[f].attachments.$[a].is_active': false,
                                updatedAt: ts,
                            },
                        },
                        { arrayFilters: [{ 'f.id': payload.entity_id }, { 'a.id': payload.attachment_id }] },
                    );
                } else if (payload.entity_type === 'PROCEDURE') {
                    await this.orderModel.findOneAndUpdate(
                        { id: orderId },
                        {
                            $set: {
                                'findings.$[f].procedures.$[p].attachments.$[a].is_active': false,
                                updatedAt: ts,
                            },
                        },
                        {
                            arrayFilters: [
                                { 'f.id': payload.finding_id },   // ← viene en el payload de deleteAttachment
                                { 'p.id': payload.entity_id },
                                { 'a.id': payload.attachment_id },
                            ]
                        },
                    );
                }
                break;

            default:
                console.warn(`⚠️ changed_scope desconocido: ${scope} | order: ${orderId}`);
        }
    }

    // ── Checksum por conteo ────────────────────────────────────────────────────
    // Retorna true si los conteos locales ya coinciden con los remotos
    async isAlreadySynced(remoteStatuses: any[], remoteTypes: any[]): Promise<boolean> {
        const [localStatusCount, localTypeCount] = await Promise.all([
            this.orderStatusModel.countDocuments(),
            this.orderTypeModel.countDocuments(),
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

    // ── Sync bulk genérica ─────────────────────────────────────────────────────
    private async bulkUpsert<T>(
        model: Model<any>,
        records: T[],
        label: string,
    ): Promise<void> {
        if (!records?.length) return;

        const operations = records.map((record: any) => ({
            updateOne: {
                filter: { id: record.id },
                update: { $set: record },
                upsert: true,
            },
        }));

        const result = await model.bulkWrite(operations, { ordered: false });
        console.log(
            `✅ Sync ${label} | Upserted: ${result.upsertedCount} | Modified: ${result.modifiedCount}`,
        );
    }

    // ── Entry point principal ──────────────────────────────────────────────────
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
            this.bulkUpsert(this.orderStatusModel, orderStatuses, 'OrderStatuses'),
            this.bulkUpsert(this.orderTypeModel, orderTypes, 'OrderTypes'),
        ]);
    }
}
