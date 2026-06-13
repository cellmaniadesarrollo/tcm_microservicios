// src/notifications/entities/order-observation.entity.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderObservationDocument = HydratedDocument<OrderObservation>;

@Schema({ timestamps: true, collection: 'order_observations' })
export class OrderObservation {
  @Prop({ type: String, default: () => new Types.UUID().toString() })
  _id?: string;

  @Prop({ required: true, index: true })
  orderId: string;  // entityId de la orden

  @Prop({ required: true, index: true })
  userId: string;  // usuario que creó la observación

  @Prop({ required: true })
  userName: string;  // nombre del usuario

  @Prop({ required: true })
  observation: string;  // texto de la observación

  @Prop({ default: false })
  isActive: boolean;  // para soft delete

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const OrderObservationSchema = SchemaFactory.createForClass(OrderObservation);

// Índices
OrderObservationSchema.index({ orderId: 1, createdAt: -1 });
OrderObservationSchema.index({ userId: 1, createdAt: -1 });
OrderObservationSchema.index({ orderId: 1, userId: 1 });