// src/notifications/entities/notification-tracking.entity.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationTrackingDocument = HydratedDocument<NotificationTracking>;

export interface NotificationAction {
  type: 'read' | 'viewed' | 'archived' | 'note_added' | 'problem_reported' | 'unarchived';
  performedBy: string;
  performedByName: string;
  performedAt: Date;
  metadata?: Record<string, any>;
}

@Schema({ 
  timestamps: true, 
  collection: 'notification_tracking'
})
export class NotificationTracking {
  @Prop({ type: String, default: () => new Types.UUID().toString() })
  _id?: string;

  @Prop({ 
    type: String, 
    required: true, 
    index: true,
    ref: 'Notification' 
  })
  notificationId: string;

  @Prop({ 
    type: String, 
    default: null 
  })
  notes: string;

  @Prop({ 
    type: Boolean, 
    default: false 
  })
  isCalled: boolean;

  @Prop({ 
    type: Boolean, 
    default: false 
  })
  hasProblems: boolean;

  @Prop({ 
    type: String, 
    default: null 
  })
  problemDescription: string;

  @Prop({ type: Date, default: null })
  calledAt: Date;

  @Prop({ type: String, default: null })
  calledBy: string;

  @Prop({ type: String, default: null })
  calledByName: string;

  @Prop({ type: Date, default: null })
  problemReportedAt: Date;

  @Prop({ type: String, default: null })
  problemReportedBy: string;

  @Prop({ type: String, default: null })
  problemReportedByName: string;

  @Prop({ type: Boolean, default: false })
  isArchived: boolean;

  @Prop({ type: Date, default: null })
  archivedAt: Date;

  @Prop({ type: String, default: null })
  archivedBy: string;

  @Prop({ type: String, default: null })
  archivedByName: string;

  @Prop({ type: Date, default: null })
  unarchivedAt: Date;

  @Prop({ type: String, default: null })
  unarchivedBy: string;

  @Prop({ type: String, default: null })
  unarchivedByName: string;

  @Prop({ type: Array, default: [] })
  actions: NotificationAction[];

  @Prop({ 
    type: String, 
    enum: ['read', 'viewed', 'archived', 'note_added', 'problem_reported', 'unarchived'], 
    default: null 
  })
  lastAction: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const NotificationTrackingSchema = SchemaFactory.createForClass(NotificationTracking);

// Índices
NotificationTrackingSchema.index({ notificationId: 1, createdAt: -1 });
NotificationTrackingSchema.index({ notificationId: 1, isArchived: 1 });
NotificationTrackingSchema.index({ notificationId: 1, isCalled: 1 });
NotificationTrackingSchema.index({ notificationId: 1, hasProblems: 1 });
NotificationTrackingSchema.index({ isCalled: 1, hasProblems: 1 });
NotificationTrackingSchema.index({ archivedAt: 1 });
NotificationTrackingSchema.index({ 'actions.performedAt': -1 });