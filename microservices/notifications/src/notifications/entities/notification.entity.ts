// src/notifications/entities/notification.entity.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ type: String, default: () => new Types.UUID().toString() })
  _id?: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  companyId: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ 
    type: String, 
    enum: ['info', 'success', 'warning', 'error'],
    default: 'info' 
  })
  type: string;

  @Prop({ default: false, index: true })
  read: boolean;

  @Prop({ type: Object, default: null })
  metadata: Record<string, any>;

  // 🆕 Campos para auditoría
  @Prop({ index: true })
  entityType: string;  // 'order', 'customer', 'product'

  @Prop({ index: true })
  entityId: string;    // ID de la orden, cliente, etc.

  @Prop({ index: true })
  action: string;      // 'created', 'updated', 'viewed', 'status_changed'

  @Prop({ type: Object, default: null })
  oldValues: any;      // Valores antes del cambio (auditoría)

  @Prop({ type: Object, default: null })
  newValues: any;      // Valores después del cambio (auditoría)

  @Prop({ type: String })
  actionDescription: string;

  @Prop({ type: Date, default: null })
  readAt: Date;

  @Prop({ type: Date, default: null })
  viewedAt: Date;      // Cuándo el usuario VIO la notificación

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Índices compuestos para búsquedas rápidas
NotificationSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ companyId: 1, createdAt: -1 });