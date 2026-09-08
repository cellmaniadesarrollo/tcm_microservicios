// src/notifications/entities/call-counter.entity.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CallCounterDocument = HydratedDocument<CallCounter>;

@Schema({ 
  timestamps: true, 
  collection: 'call_counters',
  autoIndex: true 
})
export class CallCounter {
  @Prop({ type: String, default: () => new Types.UUID().toString() })
  _id?: string;

  // ✅ ID de la orden
  @Prop({ required: true, index: true, unique: true })
  orderId: string;

  // ✅ Número de orden (para mostrar)
  @Prop({ required: true })
  orderNumber: number;

  // ✅ ID de la empresa (multi-tenant)
  @Prop({ required: true, index: true })
  companyId: string;

  // ✅ Contador de llamadas (máximo 10)
  @Prop({ type: Number, default: 0, min: 0, max: 10 })
  count: number;

  // ✅ Última llamada (fecha)
  @Prop({ type: Date, default: null })
  lastCalledAt: Date | null;

  // ✅ Usuario que hizo la última llamada
  @Prop({ type: String, default: null })
  lastCalledBy: string | null;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const CallCounterSchema = SchemaFactory.createForClass(CallCounter);

// Índices para consultas rápidas
CallCounterSchema.index({ companyId: 1, orderId: 1 });
CallCounterSchema.index({ companyId: 1, orderNumber: 1 });