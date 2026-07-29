// microservices/notifications/src/reminders/reminder.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from '../notifications/entities/notification.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectModel(Notification.name) 
    private notificationModel: Model<NotificationDocument>,
  ) {}

  // Ejecutar cada día a las 8:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkStuckOrdersAndSendReminders() {
    this.logger.log('🔍 Verificando órdenes estancadas para recordatorios a técnicos...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Días para recordatorios
    const reminderConfigs = [
      { days: 3, level: 1, message: 'primer recordatorio' },
      { days: 7, level: 2, message: 'segundo recordatorio' },
      { days: 15, level: 3, message: 'tercer recordatorio' },
      { days: 30, level: 4, message: 'cuarto recordatorio' }
    ];
    
    for (const config of reminderConfigs) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - config.days);
      cutoffDate.setHours(0, 0, 0, 0);
      
      // Buscar órdenes estancadas con técnicos asignados
      const orders = await this.notificationModel.find({
        entityType: 'order',
        currentStatus: 'INGRESADO',
        createdAt: { $lt: cutoffDate },
        'orderData.technicians': { $exists: true, $ne: [] },
        // No enviar más de un recordatorio por nivel
        'metadata.lastReminderLevel': { $ne: config.level }
      }).sort({ createdAt: 1 });
      
      this.logger.log(`📊 Nivel ${config.level} (${config.days} días): ${orders.length} órdenes encontradas`);
      
      for (const order of orders) {
        await this.sendReminderToTechnicians(order, config.days, config.level);
      }
    }
  }
  
  private async sendReminderToTechnicians(order: any, daysStuck: number, level: number) {
    const technicians = order.orderData?.technicians || [];
    const orderNumber = order.orderData?.orderNumber;
    const customerName = order.orderData?.customerName;
    const detalleIngreso = order.orderData?.detalleIngreso || 'Sin detalles';
    const device = order.orderData?.device;
    
    if (technicians.length === 0) {
      this.logger.log(`⚠️ Orden #${orderNumber} no tiene técnicos asignados, no se envía recordatorio`);
      return;
    }
    
    // Crear mensaje del dispositivo
    let deviceMessage = '';
    if (device && (device.brand || device.model)) {
      deviceMessage = `\n📱 **Dispositivo:** ${device.brand || ''} ${device.model || ''}`;
      if (device.serial_number) deviceMessage += `\n🔢 **Serie:** ${device.serial_number}`;
    }
    
    // Enviar recordatorio a CADA técnico asignado
    for (const tech of technicians) {
      const techId = tech.id;
      const techName = tech.name || `${tech.first_name || ''} ${tech.last_name || ''}`.trim() || tech.username;
      
      const title = this.getReminderTitle(level, orderNumber);
      const message = this.getReminderMessage(level, orderNumber, customerName, detalleIngreso, deviceMessage, daysStuck);
      
      const reminderNotification = new this.notificationModel({
        _id: new Types.UUID().toString(),
        userId: techId,
        companyId: order.companyId,
        title,
        message,
        type: 'warning',
        entityType: 'reminder',
        entityId: order.entityId,
        action: 'reminder',
        currentStatus: order.currentStatus,
        statusHistory: order.statusHistory,
        orderData: order.orderData,
        metadata: {
          reminderLevel: level,
          daysStuck: daysStuck,
          originalNotificationId: order._id,
          technicianId: techId,
          technicianName: techName,
          lastReminderLevel: level
        },
        read: false,
        readHistory: [],
        viewsCount: 0,
        createdAt: new Date(),
      });
      
      await reminderNotification.save();
      
      this.logger.log(`📧 Recordatorio nivel ${level} enviado al técnico ${techName} (${techId}) para orden #${orderNumber} (${daysStuck} días estancada)`);
    }
    
    // Marcar que ya se envió este nivel de recordatorio
    await this.notificationModel.updateOne(
      { _id: order._id },
      { $set: { 'metadata.lastReminderLevel': level } }
    );
  }
  
  private getReminderTitle(level: number, orderNumber: number): string {
    const titles = {
      1: `⏰ RECORDATORIO (1/4): Orden #${orderNumber} pendiente`,
      2: `⚠️ SEGUNDO RECORDATORIO: Orden #${orderNumber} sigue pendiente`,
      3: `🔴 URGENTE: Orden #${orderNumber} sin atender`,
      4: `🚨 ATENCIÓN PRIORITARIA: Orden #${orderNumber} - DEMORA EXTENDIDA`
    };
    return titles[level as keyof typeof titles] || `📌 Recordatorio: Orden #${orderNumber}`;
  }
  
  private getReminderMessage(level: number, orderNumber: number, customerName: string, detalleIngreso: string, deviceMessage: string, daysStuck: number): string {
    const messages = {
      1: `**PRIMER RECORDATORIO**\n\n` +
         `La orden #${orderNumber} lleva ${daysStuck} días en estado INGRESADO sin ser atendida.\n\n` +
         `👤 **Cliente:** ${customerName}\n` +
         `📝 **Problema:** ${detalleIngreso}${deviceMessage}\n\n` +
         `🔧 **Eres el técnico asignado.** Por favor, revisa esta orden lo antes posible.`,
      
      2: `**SEGUNDO RECORDATORIO**\n\n` +
         `⚠️ La orden #${orderNumber} lleva ${daysStuck} días en estado INGRESADO.\n\n` +
         `👤 **Cliente:** ${customerName}\n` +
         `📝 **Problema:** ${detalleIngreso}${deviceMessage}\n\n` +
         `🔧 **Eres el técnico asignado.** Esta orden requiere atención prioritaria.`,
      
      3: `**TERCER RECORDATORIO - URGENTE**\n\n` +
         `🔴 La orden #${orderNumber} lleva ${daysStuck} días en estado INGRESADO sin avance.\n\n` +
         `👤 **Cliente:** ${customerName}\n` +
         `📝 **Problema:** ${detalleIngreso}${deviceMessage}\n\n` +
         `🔧 **Eres el técnico asignado.** Por favor, atiende esta orden con urgencia.`,
      
      4: `**CUARTO RECORDATORIO - ALTA PRIORIDAD**\n\n` +
         `🚨 La orden #${orderNumber} lleva ${daysStuck} días en estado INGRESADO.\n\n` +
         `👤 **Cliente:** ${customerName}\n` +
         `📝 **Problema:** ${detalleIngreso}${deviceMessage}\n\n` +
         `🔧 **Eres el técnico asignado.** La demora en esta orden es crítica. Se requiere acción inmediata.`
    };
    return messages[level as keyof typeof messages] || messages[1];
  }
}