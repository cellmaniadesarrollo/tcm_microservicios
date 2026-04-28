// order-type.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OrderTypeDocument = OrderType & Document;

@Schema({ collection: 'order_types', timestamps: false })
export class OrderType {
    @Prop({ required: true, unique: true })
    id!: number;

    @Prop({ required: true, unique: true, maxlength: 100 })
    name!: string;
}

export const OrderTypeSchema = SchemaFactory.createForClass(OrderType);
OrderTypeSchema.index({ id: 1 }, { unique: true });