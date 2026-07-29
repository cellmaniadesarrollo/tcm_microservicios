import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OrderAuditDocument = HydratedDocument<OrderAudit>;

@Schema({ timestamps: true, collection: 'order_audits' })
export class OrderAudit {
  @Prop({ type: String, default: () => crypto.randomUUID() })
  _id: string;

  // 📦 Datos de la orden
  @Prop({ required: true, index: true })
  orderId: number;

  @Prop({ required: true, index: true })
  orderNumber: number;

  @Prop({ index: true })
  publicId: string;

  // 👤 Quién hizo la acción
  @Prop({ required: true, index: true })
  userId: string;

  @Prop()
  userName: string;

  @Prop({ required: true, index: true })
  companyId: string;

  // 🎬 Acción realizada
  @Prop({ required: true, index: true })
  action: string; // 'created', 'updated', 'status_changed', 'viewed', 'closed'

  // 📝 Detalles del cambio
  @Prop({ type: Object, default: null })
  oldValues: any;

  @Prop({ type: Object, default: null })
  newValues: any;

  // 📊 Estado de la orden en el momento
  @Prop()
  status: string;

  @Prop()
  previousStatus: string;

  // 👥 Técnicos asignados
  @Prop({ type: Array, default: [] })
  technicians: any[];

  // 🏢 Cliente
  @Prop()
  customerName: string;

  @Prop()
  customerId: number;

  // 📱 Metadata adicional
  @Prop({ type: Object, default: {} })
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    source?: string; // 'rabbitmq' o 'kafka'
    description?: string;
    changedBy?: string;
  };

  // 📅 Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export const OrderAuditSchema = SchemaFactory.createForClass(OrderAudit);

// Índices para búsquedas rápidas
OrderAuditSchema.index({ orderId: 1, createdAt: -1 });
OrderAuditSchema.index({ companyId: 1, createdAt: -1 });
OrderAuditSchema.index({ userId: 1, createdAt: -1 });
OrderAuditSchema.index({ action: 1, createdAt: -1 });