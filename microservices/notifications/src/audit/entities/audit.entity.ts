import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuditDocument = HydratedDocument<Audit>;

@Schema({ timestamps: true, collection: 'audit_logs' })
export class Audit {
  @Prop({ type: String, default: () => crypto.randomUUID() })
  _id: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  userName: string;

  @Prop({ required: true })
  userEmail: string;

  @Prop()
  userRole: string;

  @Prop({ required: true, index: true })
  entityType: string;

  @Prop({ required: true, index: true })
  entityId: string;

  @Prop()
  entityName: string;

  @Prop({ required: true, index: true })
  action: string;

  @Prop()
  actionDetail: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: Object, default: {} })
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    deviceType?: string;
    location?: string;
    timeSpent?: number;
  };

  @Prop({ default: Date.now, index: true })
  timestamp: Date;
}

export const AuditSchema = SchemaFactory.createForClass(Audit);

// Índices
AuditSchema.index({ entityId: 1, timestamp: -1 });
AuditSchema.index({ userId: 1, timestamp: -1 });