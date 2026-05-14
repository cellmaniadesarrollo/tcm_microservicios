// src/notifications/entities/notification.entity.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

// 🆕 Interfaz para el historial de lecturas
export interface ReadHistoryEntry {
  userId: string;
  userName: string;
  readAt: Date;
  action: 'read' | 'viewed';
  source: string;
  ipAddress?: string;
  userAgent?: string;
}

// 🆕 Interfaz para el historial de estados de la orden
export interface StatusHistoryEntry {
  status: string;
  changedBy: string;
  changedByName: string;
  changedAt: Date;
  description?: string;
}

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ type: String, default: () => new Types.UUID().toString() })
  _id?: string;

  @Prop({ required: false, index: true })
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

  @Prop({ index: true })
  entityType: string;

  @Prop({ index: true })
  entityId: string;

  @Prop({ index: true })
  action: string;

  // ✅ ID del usuario que CREÓ la orden (igual que changedBy del primer statusHistory)
  @Prop({ type: String, index: true, default: null })
  createdById: string;

  // ✅ Nombre del creador para mostrar en UI sin lookups adicionales
  @Prop({ type: String, default: null })
  createdByName: string;

  // Estado ACTUAL de la orden
  @Prop({ index: true })
  currentStatus: string;

  // Array con TODO el historial de estados de la orden
  @Prop({ type: Array, default: [] })
  statusHistory: StatusHistoryEntry[];

  // Datos fijos de la orden (no cambian)
  @Prop({ type: Object, default: null })
  orderData: {
    orderNumber: number;
    customerName: string;
    branch: string;
    device?: any;
    detalleIngreso?: string;
    technicians?: any[];
    createdBy?: string;
    createdById?: string; // ✅ ID también dentro de orderData para consistencia
    createdAt?: Date;
  };

  // Mantener para compatibilidad (pueden ser opcionales)
  @Prop({ type: Object, default: null })
  oldValues: any;

  @Prop({ type: Object, default: null })
  newValues: any;

  @Prop({ type: String })
  actionDescription: string;

  // PARA QUIÉN Y CUÁNDO SE MARCÓ COMO LEÍDA
  @Prop({ type: Date, default: null })
  readAt: Date;

  @Prop({ type: String, default: null })
  readBy: string;

  @Prop({ type: String, default: null })
  readByName: string;

  // FECHA DE ÚLTIMA VISUALIZACIÓN
  @Prop({ type: Date, default: null })
  lastViewedAt: Date;

  @Prop({ type: Date, default: null })
  viewedAt: Date;

  // CONTADOR DE VISUALIZACIONES
  @Prop({ default: 0 })
  viewsCount: number;

  // HISTORIAL COMPLETO DE LECTURAS/VISUALIZACIONES
  @Prop({ type: Array, default: [] })
  readHistory: ReadHistoryEntry[];

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Índices compuestos existentes
NotificationSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ companyId: 1, createdAt: -1 });
NotificationSchema.index({ readHistory: 1 });
NotificationSchema.index({ currentStatus: 1, createdAt: 1 });
NotificationSchema.index({ action: 1 });

// ✅ Nuevos índices para filtrar por creador en el frontend
NotificationSchema.index({ createdById: 1, createdAt: -1 });
NotificationSchema.index({ createdById: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ createdById: 1, companyId: 1, createdAt: -1 });