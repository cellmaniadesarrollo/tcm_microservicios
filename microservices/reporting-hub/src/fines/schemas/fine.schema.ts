// ═══════════════════════════════════════════════════════════════
// fines/schemas/fine.schema.ts
// ═══════════════════════════════════════════════════════════════
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserSnapshot, UserSnapshotSchema } from '../../orders-relay/schemas/order-replica.schema';
import { OrderMiniSnapshot, OrderMiniSnapshotSchema, PaymentMiniSnapshot, PaymentMiniSnapshotSchema, PrintableType } from '../../print/schemas/order-print-status.schema';

export enum FineType {
    REPRINT_COPY = 'REPRINT_COPY',
    // futuros motivos no relacionados a impresión también caben aquí
}

export enum FineStatus {
    PENDING = 'PENDING',
    CHARGED = 'CHARGED',
    PAID = 'PAID',
    WAIVED = 'WAIVED',
    CANCELLED = 'CANCELLED',
}

@Schema({ _id: false })
export class FineStatusHistoryEntry {
    @Prop({ required: true })
    id!: number;

    @Prop({ type: String, default: null })
    fromStatus!: FineStatus | null;

    @Prop({ required: true, enum: FineStatus })
    toStatus!: FineStatus;

    @Prop({ type: UserSnapshotSchema, required: true })
    changedBy!: UserSnapshot;

    @Prop({ type: String, default: null })
    reason?: string | null;

    @Prop({ type: Date, required: true })
    changed_at!: Date;
}
export const FineStatusHistoryEntrySchema = SchemaFactory.createForClass(FineStatusHistoryEntry);

export type FineDocument = HydratedDocument<Fine>;

@Schema({ collection: 'fines', timestamps: true })
export class Fine {
    @Prop({ required: true, enum: FineType })
    fine_type!: FineType;

    // Qué se imprimió de más (para reportes: "multas por tickets" vs "multas por recibos")
    @Prop({ type: String, required: true, enum: PrintableType })
    entity_type!: PrintableType;
    @Prop({ required: true })
    orderId!: number;

    @Prop({ type: Number, default: null })
    paymentId!: number | null;

    @Prop({ type: OrderMiniSnapshotSchema, required: true })
    order!: OrderMiniSnapshot;

    @Prop({ type: PaymentMiniSnapshotSchema, default: null })
    payment!: PaymentMiniSnapshot | null;

    // Referencia al PrintLog que originó la multa
    @Prop({ required: true })
    related_entity_type!: string; // 'PRINT_LOG'

    @Prop({ type: Types.ObjectId, required: true })
    related_entity_id!: Types.ObjectId;

    @Prop({ type: Number, required: true, default: 0.25 })
    amount!: number;

    @Prop({ type: String, default: 'USD' })
    currency!: string;

    @Prop({ required: true, enum: FineStatus, default: FineStatus.PENDING })
    status!: FineStatus;

    @Prop({ type: UserSnapshotSchema, required: true })
    finedTo!: UserSnapshot;

    @Prop({ type: UserSnapshotSchema, default: null })
    appliedBy?: UserSnapshot | null;

    @Prop({ type: String, default: null })
    observation?: string | null;

    @Prop({ type: Date, default: null })
    charged_at?: Date | null;

    @Prop({ type: String, default: null })
    payment_reference?: string | null;

    @Prop({ type: [FineStatusHistoryEntrySchema], default: [] })
    statusHistory!: FineStatusHistoryEntry[];
}

export const FineSchema = SchemaFactory.createForClass(Fine);

FineSchema.index({ orderId: 1 });
FineSchema.index({ fine_type: 1 });
FineSchema.index({ entity_type: 1 });
FineSchema.index({ status: 1 });
FineSchema.index({ 'finedTo.id': 1 });
FineSchema.index({ related_entity_type: 1, related_entity_id: 1 }, { unique: true });