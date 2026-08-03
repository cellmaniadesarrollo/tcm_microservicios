// order-status.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OrderStatusDocument = OrderStatus & Document;

@Schema({ collection: 'order_statuses', timestamps: false })
export class OrderStatus {
    @Prop({ required: true, unique: true })
    id!: number; // mismo id de Postgres

    @Prop({ required: true, unique: true, maxlength: 50 })
    name!: string;
}

export const OrderStatusSchema = SchemaFactory.createForClass(OrderStatus);
OrderStatusSchema.index({ id: 1 }, { unique: true });