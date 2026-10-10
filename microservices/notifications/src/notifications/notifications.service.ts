// src/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument, ReadHistoryEntry, StatusHistoryEntry } from './entities/notification.entity';
import { NotificationTracking, NotificationTrackingDocument } from './entities/notification-tracking.entity';

export interface DeliveredFilters {
  search?: string;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  called?: 'all' | 'called' | 'not_called' | string;
  problem?: 'all' | 'has_problem' | 'no_problem' | string;
  today?: boolean;
  todayStart?: string | Date | null;
  todayEnd?: string | Date | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) 
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(NotificationTracking.name)
    private trackingModel: Model<NotificationTrackingDocument>,
  ) {}

  // 🔹 HELPER PRIVADO: Obtiene los IDs de las notificaciones que no aplican
  private async getExcludedNotificationIds(): Promise<string[]> {
    const doesNotApplyTrackings = await this.trackingModel
      .find({ doesNotApply: true }, { notificationId: 1 })
      .lean()
      .exec();

    return doesNotApplyTrackings.map(t => t.notificationId);
  }

  async create(createDto: any) {
    const notification = new this.notificationModel({
      ...createDto,
      _id: new Types.UUID().toString(),
      read: false,
      readHistory: [],
      viewsCount: 0,
      createdAt: new Date(),
      observations: createDto.observations || null,
      scheduledFor: createDto.scheduledFor || null,
    });
    return await notification.save();
  }

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

      console.log(`📥 [createOrUpdateFromOrderEvent] Procesando orden #${orderNumber}`, {
          entityId,
          newStatus,
          action,
          userId
      });

      const createdById = orderEvent.userId
          || orderEvent.created_by_id
          || orderEvent.createdById
          || orderData.createdById
          || null;

      const createdByName = orderEvent.userName
          || orderEvent.created_by
          || orderData.createdBy
          || 'Sistema';

      let notification = await this.notificationModel.findOne({ 
          entityType: 'order', 
          entityId: entityId 
      });
      
      const technicianNames = technicians.map((t: any) => 
          `${t.first_name || ''} ${t.last_name || ''}`.trim()
      ).filter((n: string) => n).join(', ');
      
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
          const scheduledFor = orderEvent.scheduledFor || null;
          const observations = orderEvent.observations || null;

          notification = new this.notificationModel({
              _id: new Types.UUID().toString(),
              userId: userId,
              companyId: orderEvent.company_id,
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
              observations: observations,
              scheduledFor: scheduledFor,
          });
          
          notification.statusHistory.push({
              status: newStatus,
              changedBy: userId,
              changedByName: orderEvent.userName || orderEvent.created_by || 'Sistema',
              changedAt: new Date(orderEvent.timestamp) || new Date(),
              description: 'Orden creada'
          });
          
          console.log(`✅ [createOrUpdateFromOrderEvent] Notificación creada para orden #${orderNumber} con estado ${newStatus}`);
          return await notification.save();
      }
      
      const oldStatus = notification.currentStatus;
      
      // 👈 AGREGAR: Verificar si el nuevo estado es ENTREGADA
      const isDelivered = newStatus === 'ENTREGADA';
      
      if (oldStatus !== newStatus || action === 'updated') {
          console.log(`📊 [createOrUpdateFromOrderEvent] Cambio de estado: ${oldStatus} → ${newStatus}`);
          
          // 👈 AGREGAR: Si es ENTREGADA, asegurar que se guarde correctamente
          if (isDelivered) {
              console.log(`📦 [createOrUpdateFromOrderEvent] ¡Orden #${orderNumber} ENTREGADA!`);
          }
          
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

          if (!notification.createdById && createdById) {
              notification.createdById = createdById;
              notification.createdByName = createdByName;
          }
          
          // 👈 MODIFICAR: Mensaje especial para ENTREGADA
          let statusHistoryText = notification.statusHistory
              .map(h => `  • ${new Date(h.changedAt).toLocaleString()} → ${h.status} (por ${h.changedByName})`)
              .join('\n');
          
          // 👈 AGREGAR: Si es ENTREGADA, agregar información de entrega
          if (isDelivered) {
              notification.message = `${baseMessage}\n\n📦 **ESTADO: ENTREGADA**\n📅 **Fecha entrega:** ${new Date().toLocaleString()}\n\n📊 **Historial de estados:**\n${statusHistoryText}`;
              notification.type = 'success';
              
              // 👈 AGREGAR: También actualizar el título
              notification.title = `📦 Orden #${orderNumber} - ENTREGADA`;
          } else {
              notification.message = `${baseMessage}\n\n📊 **Historial de estados:**\n${statusHistoryText}`;
          }
          
          notification.updatedAt = new Date();
          
          await notification.save();
          console.log(`✅ [createOrUpdateFromOrderEvent] Notificación actualizada para orden #${orderNumber}: ${oldStatus} → ${newStatus}`);
      } else {
          console.log(`⏭️ [createOrUpdateFromOrderEvent] Sin cambios para orden #${orderNumber}, estado actual: ${oldStatus}`);
      }
      
      return notification;
  }

  async updateObservations(id: string, observations: string) {
    const notification = await this.notificationModel.findOneAndUpdate(
      { _id: id },
      { 
        observations: observations,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!notification) {
      throw new Error('Notificación no encontrada');
    }

    return notification;
  }

  async rescheduleNotification(id: string, scheduledFor: Date, observations?: string) {
    const updateData: any = {
      scheduledFor: scheduledFor,
      updatedAt: new Date()
    };

    if (observations) {
      updateData.observations = observations;
    }

    const notification = await this.notificationModel.findOneAndUpdate(
      { _id: id },
      updateData,
      { new: true }
    );

    if (!notification) {
      throw new Error('Notificación no encontrada');
    }

    return notification;
  }

  async getScheduledNotifications(currentDate: Date = new Date()) {
    return await this.notificationModel.find({
      scheduledFor: { $lte: currentDate },
      read: false
    }).sort({ scheduledFor: 1 });
  }

  async getFutureNotifications(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const currentDate = new Date();

    const query = {
      scheduledFor: { $gt: currentDate }
    };

    const [notifications, total] = await Promise.all([
      this.notificationModel
        .find(query)
        .sort({ scheduledFor: 1 })
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
    };
  }

  async cancelScheduling(id: string) {
    const notification = await this.notificationModel.findOneAndUpdate(
      { _id: id },
      { 
        scheduledFor: null,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!notification) {
      throw new Error('Notificación no encontrada');
    }

    return notification;
  }

  // 🔹 OBTENER notificaciones de un usuario
  async getUserNotifications(
    userId: string, 
    page: number = 1, 
    limit: number = 20, 
    onlyUnread: boolean = false
  ) {
    const skip = (page - 1) * limit;
    const currentDate = new Date();
    const excludedNotificationIds = await this.getExcludedNotificationIds();

    const query: any = { 
      userId,
      _id: { $nin: excludedNotificationIds },
      $or: [
        { scheduledFor: null },
        { scheduledFor: { $lte: currentDate } }
      ]
    };
    
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

  async getNotificationsByCreator(
    createdById: string,
    page: number = 1,
    limit: number = 20,
    onlyUnread: boolean = false,
    companyId?: string,
  ) {
    const skip = (page - 1) * limit;
    const currentDate = new Date();
    const excludedNotificationIds = await this.getExcludedNotificationIds();

    const query: any = { 
      createdById,
      _id: { $nin: excludedNotificationIds },
      $or: [
        { scheduledFor: null },
        { scheduledFor: { $lte: currentDate } }
      ]
    };
    
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
      this.notificationModel.countDocuments({ createdById, _id: { $nin: excludedNotificationIds }, read: false }),
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

  async getUnreadCountByCreator(createdById: string) {
    const currentDate = new Date();
    const excludedNotificationIds = await this.getExcludedNotificationIds();
    return this.notificationModel.countDocuments({ 
      createdById, 
      read: false,
      _id: { $nin: excludedNotificationIds },
      $or: [
        { scheduledFor: null },
        { scheduledFor: { $lte: currentDate } }
      ]
    });
  }

  async getCurrentStuckOrders(
    userId: string,
    targetStatus: string = 'INGRESADO',
    minDays: number = 3
  ) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - minDays);
    const excludedNotificationIds = await this.getExcludedNotificationIds();

    const orders = await this.notificationModel.find({
      userId: userId,
      _id: { $nin: excludedNotificationIds },
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
      observations: order.observations,
      scheduledFor: order.scheduledFor,
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

  async getUnreadCount(userId: string) {
    const currentDate = new Date();
    const excludedNotificationIds = await this.getExcludedNotificationIds();
    return await this.notificationModel.countDocuments({ 
      userId, 
      read: false,
      _id: { $nin: excludedNotificationIds },
      $or: [
        { scheduledFor: null },
        { scheduledFor: { $lte: currentDate } }
      ]
    });
  }

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
      observations: notification.observations,
      scheduledFor: notification.scheduledFor,
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
      observations: record.observations,
      scheduledFor: record.scheduledFor,
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

  async createBoardInvitationNotification(
    userId: string,
    boardName: string,
    invitedBy: string,
    invitationId: string
  ): Promise<any> {
    const notification = {
      userId,
      title: 'Invitación a Tablero',
      message: `${invitedBy} te ha invitado al tablero "${boardName}"`,
      type: 'board_invitation',
      entityType: 'board_invitation',
      entityId: invitationId,
      actionUrl: `/taskboard/invitations/${invitationId}`,
      metadata: {
        invitationId,
        boardName,
        invitedBy
      }
    };
    
    return this.create(notification);
  }

  // 🔹 CORREGIDO: Inclusión de la exclusión en la agregación
  async getDeliveredNotifications(
    page: number = 1,
    limit: number = 20,
    includeArchived: boolean = false,
    onlyWithNotes: boolean = false,
    filters: DeliveredFilters = {},
  ) {
    const skip = (page - 1) * limit;
    const excludedNotificationIds = await this.getExcludedNotificationIds();

    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

    // ---------- Normalizar filtros ----------
    const search = (filters.search || '').trim();
    const startDate = filters.startDate ? new Date(filters.startDate) : null;
    const endDate = filters.endDate ? new Date(filters.endDate) : null;
    const called = filters.called && filters.called !== 'all' ? filters.called : null;
    const problem = filters.problem && filters.problem !== 'all' ? filters.problem : null;

    let todayStart: Date | null = null;
    let todayEnd: Date | null = null;
    if (filters.today) {
      todayStart = filters.todayStart ? new Date(filters.todayStart) : new Date(new Date().setHours(0, 0, 0, 0));
      todayEnd = filters.todayEnd ? new Date(filters.todayEnd) : new Date(new Date().setHours(23, 59, 59, 999));
    }

    // ---------- $match inicial (usa índices, antes de cualquier lookup) ----------
    const and: any[] = [
      { $or: [{ entityType: 'order' }, { entityType: 'ORDER' }] },
    ];

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      and.push({
        $or: [
          { 'orderData.customerName': { $regex: escaped, $options: 'i' } },
          {
            $expr: {
              $regexMatch: {
                input: { $toString: { $ifNull: ['$orderData.orderNumber', ''] } },
                regex: escaped,
              },
            },
          },
        ],
      });
    }

    const matchStage: any = {
      _id: { $nin: excludedNotificationIds },
      currentStatus: 'ENTREGADA',
      $and: and,
    };
    if (!includeArchived) matchStage.isArchived = { $ne: true };
    if (onlyWithNotes) matchStage.notes = { $exists: true, $nin: [null, ''] };

    // ---------- Rango de fecha de entrega ----------
    // Siempre <= hace 1 mes; si el usuario pone "hasta" más antiguo, manda el del usuario.
    const upper = endDate && endDate < oneMonthAgo ? endDate : oneMonthAgo;
    const deliveryRange: any = { $ne: null, $lte: upper };
    if (startDate) deliveryRange.$gte = startDate;

    const pipeline: any[] = [
      { $match: matchStage },
      {
        $addFields: {
          deliveryDate: {
            $arrayElemAt: [
              {
                $map: {
                  input: {
                    $filter: {
                      input: '$statusHistory',
                      as: 'history',
                      cond: { $eq: ['$$history.status', 'ENTREGADA'] },
                    },
                  },
                  as: 'delivery',
                  in: '$$delivery.changedAt',
                },
              },
              0,
            ],
          },
        },
      },
      { $match: { deliveryDate: deliveryRange } },
      { $sort: { deliveryDate: -1 } },
      { $group: { _id: '$entityId', notification: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$notification' } },
    ];

    // ---------- Filtros que dependen de otras colecciones ----------
    // (después del $group, así el $lookup corre sobre menos documentos)
    const needsTracking = !!(called || problem || todayStart);

    if (needsTracking) {
      pipeline.push(
        {
          $lookup: {
            from: 'notification_tracking',
            let: { nid: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$notificationId', '$$nid'] } } },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
              { $project: { isCalled: 1, hasProblems: 1, calledAt: 1, archivedAt: 1 } },
            ],
            as: 'latestTracking',
          },
        },
        { $addFields: { tracking: { $arrayElemAt: ['$latestTracking', 0] } } },
      );

      const trackingMatch: any = {};
      if (called === 'called') trackingMatch['tracking.isCalled'] = true;
      if (called === 'not_called') trackingMatch['tracking.isCalled'] = { $ne: true };
      if (problem === 'has_problem') trackingMatch['tracking.hasProblems'] = true;
      if (problem === 'no_problem') trackingMatch['tracking.hasProblems'] = { $ne: true };
      if (Object.keys(trackingMatch).length) pipeline.push({ $match: trackingMatch });
    }

    if (todayStart && todayEnd) {
      const range = { $gte: todayStart, $lte: todayEnd };
      pipeline.push({
        $lookup: {
          from: 'order_observations',
          let: { oid: '$entityId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$orderId', '$$oid'] }, createdAt: range } },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ],
          as: 'todayObs',
        },
      });
      pipeline.push({
        $match: {
          $or: [
            { 'tracking.calledAt': range },
            { 'tracking.archivedAt': range },
            { archivedAt: range },
            { 'todayObs.0': { $exists: true } },
          ],
        },
      });
    }

    // ---------- Limpieza, orden y paginación ----------
    pipeline.push(
      { $project: { latestTracking: 0, todayObs: 0, tracking: 0 } },
      { $sort: { deliveryDate: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          notifications: [{ $skip: skip }, { $limit: limit }],
        },
      },
    );

    const result = await this.notificationModel.aggregate(pipeline);
    const total = result[0]?.metadata[0]?.total || 0;
    const notifications = result[0]?.notifications || [];

    console.log(`📊 Entregadas >1 mes: ${total} | filtros: ${JSON.stringify({ search, called, problem, today: !!todayStart, startDate, endDate })}`);

    return { total, page, limit, totalPages: Math.ceil(total / limit), notifications };
  }
  
  // 🔹 CORREGIDO: Exclusión añadida en la consulta de finished orders
  async getFinishedOrdersOverThreeMonths(
    page: number = 1,
    limit: number = 20,
    includeArchived: boolean = false,
    onlyWithNotes: boolean = false
  ) {
    const skip = (page - 1) * limit;
    const excludedNotificationIds = await this.getExcludedNotificationIds();
    
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const query: any = {
      _id: { $nin: excludedNotificationIds }, // 👈 Exclusión agregada
      currentStatus: 'TRABAJO FINALIZADO',
      $or: [
        { entityType: 'order' },
        { entityType: 'ORDER' }
      ]
    };
    
    if (!includeArchived) {
      query.isArchived = { $ne: true };
    }
    
    if (onlyWithNotes) {
      query.notes = { $exists: true, $nin: [null, ''] };
    }
    
    const allFinished = await this.notificationModel
      .find(query)
      .lean()
      .exec();
    
    const uniqueByOrder = new Map();
    
    allFinished.forEach(notification => {
      const finishedEntry = notification.statusHistory?.find(
        (entry: any) => entry.status === 'TRABAJO FINALIZADO'
      );
      
      if (!finishedEntry) return;
      
      const finishedDate = new Date(finishedEntry.changedAt);
      if (finishedDate > threeMonthsAgo) return;
      
      const orderId = notification.entityId;
      const existing = uniqueByOrder.get(orderId);
      
      if (!existing) {
        uniqueByOrder.set(orderId, {
          ...notification,
          finishedDate: finishedDate
        });
      }
    });
    
    const allNotifications = Array.from(uniqueByOrder.values())
      .sort((a, b) => a.finishedDate.getTime() - b.finishedDate.getTime());
    
    const total = allNotifications.length;
    const paginatedNotifications = allNotifications.slice(skip, skip + limit);
    
    console.log(`📊 Órdenes en TRABAJO FINALIZADO con más de 3 meses: ${total} (archivadas: ${!includeArchived ? 'excluidas' : 'incluidas'}, solo con notas: ${onlyWithNotes})`);
    
    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      notifications: paginatedNotifications,
    };
  }

  async updateNotificationNotes(
    notificationId: string,
    userId: string,
    notes: string
  ): Promise<{ modifiedCount: number; orderId: string }> {
    const notification = await this.notificationModel.findOne({ _id: notificationId });
    
    if (!notification) {
      throw new Error('Notificación no encontrada');
    }
    
    const orderId = notification.entityId;
    
    const result = await this.notificationModel.updateMany(
      { entityId: orderId },
      { 
        notes: notes || null, 
        updatedAt: new Date() 
      }
    );
    
    console.log(`📝 Notas actualizadas en ${result.modifiedCount} notificaciones para la orden ${orderId} por usuario ${userId}`);
    
    return { 
      modifiedCount: result.modifiedCount, 
      orderId: orderId 
    };
  }

  async archiveNotification(
    notificationId: string,
    userId: string,
    archived: boolean
  ): Promise<{ modifiedCount: number; orderId: string }> {
    const notification = await this.notificationModel.findOne({ _id: notificationId });
    
    if (!notification) {
      throw new Error('Notificación no encontrada');
    }
    
    const orderId = notification.entityId;
    
    const result = await this.notificationModel.updateMany(
      { 
        entityId: orderId,
        currentStatus: { $in: ['ENTREGADA', 'TRABAJO FINALIZADO'] }
      },
      {
        isArchived: archived,
        archivedAt: archived ? new Date() : null,
        archivedBy: archived ? userId : null,
        updatedAt: new Date()
      }
    );
    
    console.log(`${archived ? '📦 Archivadas' : '📂 Desarchivadas'} ${result.modifiedCount} notificaciones para la orden ${orderId} por usuario ${userId}`);
    
    return { 
      modifiedCount: result.modifiedCount, 
      orderId: orderId 
    };
  }

  // 🔹 CORREGIDO: Exclusión añadida en órdenes entregadas revisadas
  async getReviewedDeliveredOrders(
    userId: string,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;
    const excludedNotificationIds = await this.getExcludedNotificationIds();
    
    const baseQuery = {
      userId: userId,
      _id: { $nin: excludedNotificationIds }, // 👈 Exclusión agregada
      currentStatus: 'ENTREGADA',
      $or: [
        { entityType: 'order' },
        { entityType: 'ORDER' }
      ]
    };
    
    const queryWithNotes = {
      ...baseQuery,
      notes: { $exists: true, $nin: [null, ''] }
    };
    
    const queryArchived = {
      ...baseQuery,
      isArchived: true
    };
    
    const [notificationsWithNotes, notificationsArchived] = await Promise.all([
      this.notificationModel.find(queryWithNotes).lean().exec(),
      this.notificationModel.find(queryArchived).lean().exec()
    ]);
    
    const allNotifications = [...notificationsWithNotes, ...notificationsArchived];
    const uniqueByOrder = new Map();
    
    allNotifications.forEach(notification => {
      const orderId = notification.entityId;
      if (!uniqueByOrder.has(orderId)) {
        uniqueByOrder.set(orderId, notification);
      }
    });
    
    const uniqueNotifications = Array.from(uniqueByOrder.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    
    const total = uniqueNotifications.length;
    const paginatedNotifications = uniqueNotifications.slice(skip, skip + limit);
    
    console.log(`📊 Órdenes entregadas revisadas: ${total}`);
    
    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      notifications: paginatedNotifications,
    };
  }
}