// src/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument, ReadHistoryEntry, StatusHistoryEntry } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) 
    private notificationModel: Model<NotificationDocument>,
  ) {}

  async create(createDto: any) {
    const notification = new this.notificationModel({
      ...createDto,
      _id: new Types.UUID().toString(),
      read: false,
      readHistory: [],
      viewsCount: 0,
      createdAt: new Date(),
    });
    return await notification.save();
  }

  // 🔹 CREAR o ACTUALIZAR notificación (UNA SOLA POR ORDEN)
  async createOrUpdateFromOrderEvent(orderEvent: any) {
    const device = orderEvent.device || {};
    const orderData = orderEvent.order || {};
    const orderNumber = orderData.orderNumber || orderEvent.order_number || orderEvent.order_id;
    const customerName = orderData.customerName || orderEvent.customer_name || 'Cliente';
    const branch = orderData.branch || orderEvent.branch || 'Sucursal Principal';
    const detalleIngreso = orderEvent.detalleIngreso || orderData.detalleIngreso || 'Sin detalles';
    const technicians = orderEvent.technicians || [];
    const entityId = orderEvent.order_id?.toString();
    const userId = orderEvent.userId || orderEvent.changed_by;
    const newStatus = orderData.status || orderEvent.newValue?.status || 'INGRESADO';
    const action = orderEvent.action || 'created';

    // ✅ FIX: userId es la fuente primaria (es quien crea/modifica la orden)
    // Misma lógica que usa changedBy en statusHistory
    const createdById = orderEvent.userId
      || orderEvent.created_by_id
      || orderEvent.createdById
      || orderData.createdById
      || null;

    const createdByName = orderEvent.userName
      || orderEvent.created_by
      || orderData.createdBy
      || 'Sistema';

    // Verificar si ya existe una notificación para esta orden
    let notification = await this.notificationModel.findOne({ 
      entityType: 'order', 
      entityId: entityId 
    });
    
    const technicianNames = technicians.map((t: any) => 
      `${t.first_name || ''} ${t.last_name || ''}`.trim()
    ).filter((n: string) => n).join(', ');
    
    // Construir mensaje del dispositivo
    let deviceMessage = '';
    if (device && (device.brand || device.model)) {
      deviceMessage = `\n📱 **Dispositivo:** ${device.brand || ''} ${device.model || ''}`.trim();
      if (device.serial_number) deviceMessage += `\n🔢 **Serie:** ${device.serial_number}`;
      if (device.imei) deviceMessage += `\n📱 **IMEI:** ${device.imei}`;
    }
    
    const title = `📋 Orden #${orderNumber} - ${customerName}`;
    const baseMessage = `**Orden de servicio**\n` +
      `📋 **Número:** #${orderNumber}\n` +
      `👤 **Cliente:** ${customerName}\n` +
      `📝 **Problema:** ${detalleIngreso}\n` +
      `${deviceMessage}` +
      `\n👨‍🔧 **Técnico(s):** ${technicianNames || 'No asignado'}\n` +
      `🏢 **Sucursal:** ${branch}\n` +
      `📅 **Fecha creación:** ${new Date(orderEvent.timestamp).toLocaleString()}`;
    
    if (!notification) {
      // CREAR nueva notificación (primera vez)
      notification = new this.notificationModel({
        _id: new Types.UUID().toString(),
        userId: userId,
        companyId: orderEvent.company_id,

        // ✅ createdById = userId (mismo valor que changedBy en statusHistory)
        createdById: createdById,
        createdByName: createdByName,

        title,
        message: baseMessage,
        type: action === 'created' ? 'success' : 'info',
        entityType: 'order',
        entityId: entityId,
        action: action,
        currentStatus: newStatus,
        statusHistory: [],
        orderData: {
          orderNumber,
          customerName,
          branch,
          device,
          detalleIngreso,
          technicians,
          createdBy: createdByName,
          createdById: createdById,
          createdAt: orderEvent.timestamp
        },
        metadata: {
          order: orderEvent.order,
          technicians: orderEvent.technicians,
          device: device,
          ipAddress: orderEvent.ipAddress,
          userAgent: orderEvent.userAgent,
          source: 'order_service',
        },
        oldValues: null,
        newValues: { status: newStatus },
        actionDescription: 'Orden creada',
        read: false,
        readHistory: [],
        viewsCount: 0,
        createdAt: new Date(),
      });
      
      // Agregar estado inicial al historial
      notification.statusHistory.push({
        status: newStatus,
        changedBy: userId,
        changedByName: orderEvent.userName || orderEvent.created_by || 'Sistema',
        changedAt: new Date(orderEvent.timestamp) || new Date(),
        description: 'Orden creada'
      });
      
      return await notification.save();
    }
    
    // ACTUALIZAR notificación existente (cambio de estado)
    const oldStatus = notification.currentStatus;
    
    if (oldStatus !== newStatus || action === 'updated') {
      const statusEntry: StatusHistoryEntry = {
        status: newStatus,
        changedBy: userId,
        changedByName: orderEvent.userName || orderEvent.changed_by || 'Sistema',
        changedAt: new Date(orderEvent.timestamp) || new Date(),
        description: orderEvent.description || `Estado cambiado de ${oldStatus} a ${newStatus}`
      };
      
      notification.statusHistory.push(statusEntry);
      notification.currentStatus = newStatus;
      notification.action = action;
      notification.newValues = { status: newStatus };
      notification.actionDescription = orderEvent.description || `Estado cambiado a ${newStatus}`;

      // Rellenar createdById si estaba vacío (parche para docs anteriores)
      if (!notification.createdById && createdById) {
        notification.createdById = createdById;
        notification.createdByName = createdByName;
      }
      
      const statusHistoryText = notification.statusHistory
        .map(h => `  • ${new Date(h.changedAt).toLocaleString()} → ${h.status} (por ${h.changedByName})`)
        .join('\n');
      
      notification.message = `${baseMessage}\n\n📊 **Historial de estados:**\n${statusHistoryText}`;
      notification.updatedAt = new Date();
      
      await notification.save();
    }
    
    return notification;
  }

  // Mantener método original para compatibilidad
  async createFromOrderEvent(orderEvent: any) {
    return this.createOrUpdateFromOrderEvent(orderEvent);
  }

  // 🔹 OBTENER notificaciones de un usuario
  async getUserNotifications(
    userId: string, 
    page: number = 1, 
    limit: number = 20, 
    onlyUnread: boolean = false
  ) {
    const skip = (page - 1) * limit;
    
    const query: any = { userId };
    if (onlyUnread) query.read = false;
    
    const [notifications, total] = await Promise.all([
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
      notifications,
      unreadCount: await this.getUnreadCount(userId)
    };
  }

  // ✅ OBTENER notificaciones filtradas por el creador de la orden
  async getNotificationsByCreator(
    createdById: string,
    page: number = 1,
    limit: number = 20,
    onlyUnread: boolean = false,
    companyId?: string,
  ) {
    const skip = (page - 1) * limit;

    const query: any = { createdById };
    if (onlyUnread) query.read = false;
    if (companyId) query.companyId = companyId;

    const [notifications, total, unreadCount] = await Promise.all([
      this.notificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments(query),
      this.notificationModel.countDocuments({ createdById, read: false }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      notifications,
      unreadCount,
    };
  }

  // ✅ OBTENER contador de no leídas por creador
  async getUnreadCountByCreator(createdById: string) {
    return this.notificationModel.countDocuments({ createdById, read: false });
  }

  // 🔹 OBTENER órdenes estancadas (usando currentStatus)
  async getCurrentStuckOrders(
    userId: string,
    targetStatus: string = 'INGRESADO',
    minDays: number = 3
  ) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - minDays);
    
    const orders = await this.notificationModel.find({
      userId: userId,
      entityType: 'order',
      currentStatus: targetStatus,
      createdAt: { $lt: cutoffDate }
    }).sort({ createdAt: 1 });
    
    const formattedOrders = orders.map(order => ({
      orderId: order.entityId,
      orderNumber: order.orderData?.orderNumber,
      customerName: order.orderData?.customerName,
      currentStatus: order.currentStatus,
      lastUpdate: order.createdAt,
      daysStuck: Math.floor((Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      device: order.orderData?.device,
      technicians: order.orderData?.technicians,
      statusHistory: order.statusHistory,
      createdById: order.createdById,
      createdByName: order.createdByName,
    }));
    
    console.log(`📊 [getCurrentStuckOrders] Usuario: ${userId}, Estado: ${targetStatus}, Días: ${minDays}`);
    console.log(`📊 Órdenes encontradas: ${formattedOrders.length}`);
    
    return {
      status: targetStatus,
      minDays: minDays,
      totalStuck: formattedOrders.length,
      orders: formattedOrders
    };
  }

  // 🔹 OBTENER contador de notificaciones NO LEÍDAS
  async getUnreadCount(userId: string) {
    return await this.notificationModel.countDocuments({ 
      userId, 
      read: false 
    });
  }

  // 🔹 MARCAR como leída (con historial)
  async markAsRead(id: string, userId: string, userName?: string, source: string = 'api') {
    const notification = await this.notificationModel.findOne({ _id: id });

    if (!notification) {
      throw new Error('Notificación no encontrada');
    }

    const readEntry: ReadHistoryEntry = {
      userId: userId,
      userName: userName || userId,
      readAt: new Date(),
      action: 'read',
      source: source,
    };

    const updated = await this.notificationModel.findOneAndUpdate(
      { _id: id },
      {
        read: true,
        readAt: new Date(),
        readBy: userId,
        readByName: userName || userId,
        $push: { readHistory: readEntry },
        $inc: { viewsCount: 1 },
        lastViewedAt: new Date(),
        viewedAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );

    return updated;
  }

  // 🔹 REGISTRAR visualización
  async trackView(id: string, userId: string, userName?: string, source: string = 'web', accessData?: any) {
    const notification = await this.notificationModel.findOne({ _id: id });

    if (!notification) {
      throw new Error('Notificación no encontrada');
    }

    const viewEntry: ReadHistoryEntry = {
      userId: userId,
      userName: userName || userId,
      readAt: new Date(),
      action: 'viewed',
      source: source,
      ipAddress: accessData?.ipAddress,
      userAgent: accessData?.userAgent,
    };

    const updated = await this.notificationModel.findOneAndUpdate(
      { _id: id },
      {
        $push: { readHistory: viewEntry },
        $inc: { viewsCount: 1 },
        lastViewedAt: new Date(),
        viewedAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );

    return updated;
  }

  // 🔹 OBTENER historial completo de una notificación
  async getNotificationHistory(id: string) {
    const notification = await this.notificationModel.findOne({ _id: id });
    if (!notification) {
      throw new Error('Notificación no encontrada');
    }
    return {
      id: notification._id,
      title: notification.title,
      read: notification.read,
      readAt: notification.readAt,
      readBy: notification.readBy,
      readByName: notification.readByName,
      viewsCount: notification.viewsCount || 0,
      readHistory: notification.readHistory || [],
      statusHistory: notification.statusHistory || [],
      currentStatus: notification.currentStatus,
      orderData: notification.orderData,
      lastViewedAt: notification.lastViewedAt,
      createdAt: notification.createdAt,
      createdById: notification.createdById,
      createdByName: notification.createdByName,
    };
  }

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
      readBy: record.readBy,
      readByName: record.readByName,
      viewsCount: record.viewsCount,
      readHistory: record.readHistory,
      statusHistory: record.statusHistory,
      currentStatus: record.currentStatus,
      metadata: record.metadata,
      createdById: record.createdById,
      createdByName: record.createdByName,
    }));
  }

  async getAuditHistoryAdvanced(filters: any) {
    const query: any = {};
    if (filters.companyId) query.companyId = filters.companyId;
    if (filters.entityType) query.entityType = filters.entityType;
    if (filters.entityId) query.entityId = filters.entityId;
    if (filters.action) query.action = filters.action;
    if (filters.userId) query.userId = filters.userId;
    if (filters.createdById) query.createdById = filters.createdById;
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [history, total] = await Promise.all([
      this.notificationModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.notificationModel.countDocuments(query),
    ]);

    return { total, page, limit, totalPages: Math.ceil(total / limit), history };
  }

  async trackAccess(notificationId: string, userId: string, accessData: any) {
    return this.trackView(notificationId, userId, accessData?.userName, 'web', accessData);
  }

  async getAuditStats(companyId: string, startDate: Date, endDate: Date) {
    const stats = await this.notificationModel.aggregate([
      { $match: { companyId, createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$action', count: { $sum: 1 }, uniqueUsers: { $addToSet: '$userId' } } },
      { $project: { action: '$_id', count: 1, uniqueUsers: { $size: '$uniqueUsers' }, _id: 0 } },
      { $sort: { count: -1 } }
    ]);

    const totalStats = await this.notificationModel.aggregate([
      { $match: { companyId, createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: null, total: { $sum: 1 }, read: { $sum: { $cond: ['$read', 1, 0] } }, viewed: { $sum: { $cond: [{ $ne: ['$viewedAt', null] }, 1, 0] } } } }
    ]);

    return { byAction: stats, totals: totalStats[0] || { total: 0, read: 0, viewed: 0 } };
  }

  async deleteOldNotifications(daysOld: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const result = await this.notificationModel.deleteMany({ createdAt: { $lt: cutoffDate } });
    return { deleted: result.deletedCount, message: `Se eliminaron ${result.deletedCount} notificaciones anteriores a ${daysOld} días` };
  }

  private getTypeForAction(action: string): 'info' | 'success' | 'warning' | 'error' {
    const types: Record<string, any> = { created: 'success', updated: 'info', status_changed: 'warning', viewed: 'info' };
    return types[action] || 'info';
  }
}