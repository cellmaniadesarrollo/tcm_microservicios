import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserSnapshot, UserSnapshotSchema } from '../../orders-relay/schemas/order-replica.schema';
import {
    OrderMiniSnapshot,
    OrderMiniSnapshotSchema,
    PaymentMiniSnapshot,
    PaymentMiniSnapshotSchema,
    PrintableType,
} from './order-print-status.schema';

export enum PrintType {
    ORIGINAL = 'ORIGINAL',
    COPY = 'COPY',
}

export type OrderPrintLogDocument = HydratedDocument<OrderPrintLog>;

@Schema({ collection: 'order_print_logs', timestamps: true })
export class OrderPrintLog {
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

    @Prop({ type: UserSnapshotSchema, required: true })
    printedBy!: UserSnapshot;

    @Prop({ type: UserSnapshotSchema, required: true })
    requestedBy!: UserSnapshot;

    @Prop({ type: Date, required: true })
    printed_at!: Date;

    @Prop({ type: String, required: true, enum: PrintType })
    print_type!: PrintType;

    @Prop({ required: true, default: 1 })
    copy_number!: number;

    @Prop({ default: false })
    was_fined!: boolean;

    @Prop({ default: false })
    is_original_reprint!: boolean;

    @Prop({ type: String, default: null })
    reprint_reason?: string | null;

    @Prop({ type: UserSnapshotSchema, default: null })
    authorized_by?: UserSnapshot | null;

    @Prop({ type: String, default: null })
    ip_address?: string | null;

    @Prop({ type: String, default: null })
    device_info?: string | null;
}

export const OrderPrintLogSchema = SchemaFactory.createForClass(OrderPrintLog);

OrderPrintLogSchema.index({ entity_type: 1, orderId: 1, paymentId: 1, printed_at: -1 });
OrderPrintLogSchema.index({ 'printedBy.id': 1 });
OrderPrintLogSchema.index({ 'requestedBy.id': 1 });
OrderPrintLogSchema.index({ print_type: 1 });