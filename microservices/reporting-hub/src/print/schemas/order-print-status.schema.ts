import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserSnapshot, UserSnapshotSchema } from '../../orders-relay/schemas/order-replica.schema';

export enum PrintableType {
    ORDER_TICKET = 'ORDER_TICKET',
    PAYMENT_RECEIPT = 'PAYMENT_RECEIPT',
}

// ── Mini snapshot de la orden ─────────────────────────────────────────────────
@Schema({ _id: false })
export class OrderMiniSnapshot {
    @Prop({ required: true })
    id!: number;

    @Prop({ required: true })
    order_number!: number;

    @Prop({ type: String })
    company_name?: string;

    @Prop({ type: String })
    branch_name?: string;
}
export const OrderMiniSnapshotSchema = SchemaFactory.createForClass(OrderMiniSnapshot);

// ── Mini snapshot del pago (solo cuando entity_type = PAYMENT_RECEIPT) ────────
@Schema({ _id: false })
export class PaymentMiniSnapshot {
    @Prop({ required: true })
    id!: number; // PaymentSnapshot.id embebido en la orden

    @Prop({ type: Number, required: true })
    amount!: number;

    @Prop()
    flow_type!: string; // INGRESO | EGRESO

    @Prop({ type: String })
    payment_type_name?: string;

    @Prop({ type: Date })
    paid_at!: Date;
}
export const PaymentMiniSnapshotSchema = SchemaFactory.createForClass(PaymentMiniSnapshot);

// ── OrderPrintStatus (documento raíz) ─────────────────────────────────────────
export type OrderPrintStatusDocument = HydratedDocument<OrderPrintStatus>;

@Schema({ collection: 'order_print_status', timestamps: true })
export class OrderPrintStatus {
    @Prop({ required: true, enum: PrintableType })
    entity_type!: PrintableType;

    @Prop({ required: true })
    orderId!: number; // siempre presente, incluso para recibos de pago

    @Prop({ type: Number, default: null })
    paymentId!: number | null; // solo cuando entity_type = PAYMENT_RECEIPT

    @Prop({ type: OrderMiniSnapshotSchema, required: true })
    order!: OrderMiniSnapshot;

    @Prop({ type: PaymentMiniSnapshotSchema, default: null })
    payment!: PaymentMiniSnapshot | null;

    @Prop({ default: false })
    is_printed!: boolean;

    @Prop({ default: 0 })
    print_count!: number;

    @Prop({ type: Date, default: null })
    first_printed_at!: Date | null;

    @Prop({ type: UserSnapshotSchema, default: null })
    first_printed_by!: UserSnapshot | null;

    @Prop({ type: Date, default: null })
    last_printed_at!: Date | null;

    @Prop({ type: UserSnapshotSchema, default: null })
    last_printed_by!: UserSnapshot | null;
}

export const OrderPrintStatusSchema = SchemaFactory.createForClass(OrderPrintStatus);

// Único por combinación de tipo + orden + pago (paymentId = null para ORDER_TICKET)
OrderPrintStatusSchema.index(
    { entity_type: 1, orderId: 1, paymentId: 1 },
    { unique: true },
);
OrderPrintStatusSchema.index({ orderId: 1 });
OrderPrintStatusSchema.index({ is_printed: 1 });