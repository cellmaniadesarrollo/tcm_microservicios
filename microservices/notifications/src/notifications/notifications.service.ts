// src/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) 
    private notificationModel: Model<NotificationDocument>,
  ) {}

  // 🔹 CREAR notificación
  async create(createDto: CreateNotificationDto) {
    const notification = new this.notificationModel({
      ...createDto,
      _id: new Types.UUID().toString(),
      read: false,
      createdAt: new Date(),
    });
    
    return await notification.save();
  }

  // 🔹 CREAR desde evento de orden (auditoría + notificación)
  async createFromOrderEvent(orderEvent: any) {
    const notification = new this.notificationModel({
      _id: new Types.UUID().toString(),
      userId: orderEvent.userId || orderEvent.changed_by,
      companyId: orderEvent.company_id,
      title: this.getTitleForAction(orderEvent.action, orderEvent.order),
      message: this.getMessageForAction(orderEvent.action, orderEvent),
      type: this.getTypeForAction(orderEvent.action),
      entityType: 'order',
      entityId: orderEvent.order_id?.toString(),
      action: orderEvent.action,
      oldValues: orderEvent.previousValue ? { status: orderEvent.previousValue } : null,
      newValues: orderEvent.newValue ? { status: orderEvent.newValue } : orderEvent.order,
      actionDescription: orderEvent.description,
      metadata: {
        order: orderEvent.order,
        technicians: orderEvent.technicians,
        ipAddress: orderEvent.ipAddress,
        userAgent: orderEvent.userAgent,
        source: 'order_service',
      },
      read: false,
      createdAt: new Date(),
    });

    return await notification.save();
  }

  // 🔹 OBTENER notificaciones de un usuario (para UI)
  async getUserNotifications(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    const [notifications, total] = await Promise.all([
      this.notificationModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments({ userId }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      notifications,
    };
  }

  // 🔹 OBTENER historial de auditoría de una entidad
  async getAuditHistory(entityType: string, entityId: string, companyId: string) {
    const history = await this.notificationModel
      .find({ entityType, entityId, companyId })
      .sort({ createdAt: -1 })
      .exec();

    return history.map(record => ({
      id: record._id,
      action: record.action,
      user: record.userId,
      title: record.title,
      message: record.message,
      oldValues: record.oldValues,
      newValues: record.newValues,
      description: record.actionDescription,
      createdAt: record.createdAt,
      viewedAt: record.viewedAt,
      readAt: record.readAt,
      metadata: record.metadata,
    }));
  }

  // 🔹 OBTENER historial COMPLETO con filtros avanzados
  async getAuditHistoryAdvanced(filters: {
    companyId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const query: any = {};
    
    if (filters.companyId) query.companyId = filters.companyId;
    if (filters.entityType) query.entityType = filters.entityType;
    if (filters.entityId) query.entityId = filters.entityId;
    if (filters.action) query.action = filters.action;
    if (filters.userId) query.userId = filters.userId;
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [history, total] = await Promise.all([
      this.notificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments(query),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      history,
    };
  }

  // 🔹 MARCAR como leída
  async markAsRead(id: string, userId: string) {
    const notification = await this.notificationModel.findOneAndUpdate(
      { _id: id, userId },
      { 
        read: true, 
        readAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!notification) {
      throw new Error('Notificación no encontrada');
    }

    return notification;
  }

  // 🔹 REGISTRAR acceso del usuario
  async trackAccess(notificationId: string, userId: string, accessData: any) {
    const notification = await this.notificationModel.findOne({ 
      _id: notificationId, 
      userId 
    });

    if (!notification) {
      throw new Error('Notificación no encontrada');
    }

    // Registrar acceso en metadata
    const accesses = notification.metadata?.accesses || [];
    accesses.push({
      accessedAt: new Date(),
      ipAddress: accessData.ipAddress,
      userAgent: accessData.userAgent,
      timeSpent: accessData.timeSpent,
    });

    notification.metadata = {
      ...notification.metadata,
      accesses,
      lastAccessedAt: new Date(),
      totalAccesses: accesses.length,
    };
    notification.viewedAt = new Date();
    notification.updatedAt = new Date();

    return await notification.save();
  }

  // 🔹 OBTENER estadísticas de auditoría (agregaciones de MongoDB)
  async getAuditStats(companyId: string, startDate: Date, endDate: Date) {
    const stats = await this.notificationModel.aggregate([
      {
        $match: {
          companyId,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          action: '$_id',
          count: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          _id: 0
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Estadísticas adicionales
    const totalStats = await this.notificationModel.aggregate([
      {
        $match: {
          companyId,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          read: { $sum: { $cond: ['$read', 1, 0] } },
          viewed: { $sum: { $cond: [{ $ne: ['$viewedAt', null] }, 1, 0] } }
        }
      }
    ]);

    return {
      byAction: stats,
      totals: totalStats[0] || { total: 0, read: 0, viewed: 0 }
    };
  }

  // 🔹 ELIMINAR notificaciones antiguas
  async deleteOldNotifications(daysOld: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.notificationModel.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    return {
      deleted: result.deletedCount,
      message: `Se eliminaron ${result.deletedCount} notificaciones anteriores a ${daysOld} días`
    };
  }

  // Métodos auxiliares
  private getTitleForAction(action: string, order: any): string {
    const titles = {
      created: `📋 Orden ${order?.orderNumber || ''} creada`,
      updated: `✏️ Orden ${order?.orderNumber || ''} actualizada`,
      status_changed: `🔄 Orden ${order?.orderNumber || ''} cambió de estado`,
      viewed: `👀 Orden ${order?.orderNumber || ''} visualizada`,
    };
    return titles[action] || `📌 Actualización de orden ${order?.orderNumber || ''}`;
  }

  private getMessageForAction(action: string, event: any): string {
    switch (action) {
      case 'created':
        return `La orden ${event.order?.orderNumber} fue creada por ${event.changed_by || 'el sistema'}`;
      case 'status_changed':
        return `La orden ${event.order?.orderNumber} cambió de "${event.previousValue}" a "${event.newValue}"`;
      case 'viewed':
        return `La orden ${event.order?.orderNumber} fue visualizada`;
      default:
        return event.description || `Se actualizó la orden ${event.order?.orderNumber}`;
    }
  }

  private getTypeForAction(action: string): 'info' | 'success' | 'warning' | 'error' {
    const types = {
      created: 'success',
      updated: 'info',
      status_changed: 'warning',
      viewed: 'info',
    };
    return types[action] as any || 'info';
  }
}