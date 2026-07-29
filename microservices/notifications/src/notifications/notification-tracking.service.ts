// src/notifications/notification-tracking.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationTracking, NotificationTrackingDocument } from './entities/notification-tracking.entity';
import { Notification } from './entities/notification.entity';
import { CreateNotificationTrackingDto } from './dto/create-notification-tracking.dto';
import { UpdateNotificationTrackingDto } from './dto/update-notification-tracking.dto';

@Injectable()
export class NotificationTrackingService {
  constructor(
    @InjectModel(NotificationTracking.name)
    private trackingModel: Model<NotificationTrackingDocument>,
    @InjectModel(Notification.name)
    private notificationModel: Model<Notification>,
  ) {}

  /**
   * Crear un nuevo tracking para una notificación
   */
  async create(createDto: CreateNotificationTrackingDto): Promise<NotificationTrackingDocument> {
    const notification = await this.notificationModel.findById(createDto.notificationId);
    if (!notification) {
      throw new NotFoundException(`Notification with id ${createDto.notificationId} not found`);
    }

    const tracking = new this.trackingModel({
      ...createDto,
      actions: [{
        type: 'note_added',
        performedBy: createDto.calledBy || 'system',
        performedByName: createDto.calledByName || 'Sistema',
        performedAt: new Date(),
        metadata: { notes: createDto.notes || 'Tracking inicial creado' }
      }]
    });

    return await tracking.save();
  }

  /**
   * Obtener todos los tracking de una notificación
   */
  async findByNotificationId(notificationId: string): Promise<NotificationTrackingDocument[]> {
    return await this.trackingModel.find({ notificationId })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Obtener el tracking más reciente de una notificación
   */
  async findLatestByNotificationId(notificationId: string): Promise<NotificationTrackingDocument> {
    const notification = await this.notificationModel.findById(notificationId);
    if (!notification) {
      throw new NotFoundException(`Notification with id ${notificationId} not found`);
    }

    // ✅ Buscar tracking existente
    const existingTracking = await this.trackingModel.findOne({ notificationId })
      .sort({ createdAt: -1 })
      .exec();
    
    // ✅ Si existe, retornarlo
    if (existingTracking) {
      return existingTracking as any as NotificationTrackingDocument;
    }
    
    // ✅ Si no existe, crear uno nuevo
    const newTracking = await this.create({ 
      notificationId,
      notes: 'Tracking inicial creado automáticamente'
    });
    
    // ✅ Retornar el nuevo tracking con casteo doble
    return newTracking as any as NotificationTrackingDocument;
  }

  /**
   * Actualizar tracking por ID
   */
  async update(
    id: string, 
    updateDto: UpdateNotificationTrackingDto
  ): Promise<NotificationTrackingDocument> {
    const tracking = await this.trackingModel.findById(id);
    if (!tracking) {
      throw new NotFoundException(`Tracking not found with id ${id}`);
    }

    // Validar que isCalled no se pueda desmarcar
    if (updateDto.isCalled !== undefined && updateDto.isCalled === false && tracking.isCalled === true) {
      throw new BadRequestException('No se puede desmarcar "isCalled" una vez que ha sido marcado como true');
    }

    // Registrar acciones en el historial
    const actions: any[] = [];
    
    if (updateDto.isCalled !== undefined && updateDto.isCalled !== tracking.isCalled) {
      actions.push({
        type: 'read',
        performedBy: updateDto.calledBy || tracking.calledBy || 'system',
        performedByName: updateDto.calledByName || tracking.calledByName || 'Sistema',
        performedAt: new Date(),
        metadata: { 
          previousValue: tracking.isCalled, 
          newValue: updateDto.isCalled,
          notes: updateDto.notes 
        }
      });
    }

    if (updateDto.hasProblems !== undefined && updateDto.hasProblems !== tracking.hasProblems) {
      actions.push({
        type: 'problem_reported',
        performedBy: updateDto.problemReportedBy || updateDto.calledBy || tracking.calledBy || 'system',
        performedByName: updateDto.problemReportedByName || updateDto.calledByName || tracking.calledByName || 'Sistema',
        performedAt: new Date(),
        metadata: { 
          previousValue: tracking.hasProblems, 
          newValue: updateDto.hasProblems,
          problemDescription: updateDto.problemDescription 
        }
      });
    }

    if (updateDto.isArchived !== undefined && updateDto.isArchived !== tracking.isArchived) {
      actions.push({
        type: updateDto.isArchived ? 'archived' : 'unarchived',
        performedBy: updateDto.archivedBy || tracking.archivedBy || 'system',
        performedByName: updateDto.archivedByName || tracking.archivedByName || 'Sistema',
        performedAt: new Date(),
        metadata: { 
          previousValue: tracking.isArchived, 
          newValue: updateDto.isArchived 
        }
      });
    }

    if (updateDto.notes && updateDto.notes !== tracking.notes) {
      actions.push({
        type: 'note_added',
        performedBy: updateDto.calledBy || tracking.calledBy || 'system',
        performedByName: updateDto.calledByName || tracking.calledByName || 'Sistema',
        performedAt: new Date(),
        metadata: { 
          previousNotes: tracking.notes, 
          newNotes: updateDto.notes 
        }
      });
    }

    // Actualizar campos
    if (updateDto.isCalled !== undefined) {
      tracking.isCalled = updateDto.isCalled;
      if (updateDto.isCalled) {
        tracking.calledAt = new Date();
        tracking.calledBy = updateDto.calledBy || tracking.calledBy || 'system';
        tracking.calledByName = updateDto.calledByName || tracking.calledByName || 'Sistema';
      }
    }

    if (updateDto.hasProblems !== undefined) {
      tracking.hasProblems = updateDto.hasProblems;
      if (updateDto.hasProblems) {
        tracking.problemReportedAt = new Date();
        tracking.problemReportedBy = updateDto.problemReportedBy || updateDto.calledBy || tracking.calledBy || 'system';
        tracking.problemReportedByName = updateDto.problemReportedByName || updateDto.calledByName || tracking.calledByName || 'Sistema';
      }
      if (updateDto.problemDescription !== undefined) {
        tracking.problemDescription = updateDto.problemDescription;
      }
    }

    if (updateDto.isArchived !== undefined) {
      tracking.isArchived = updateDto.isArchived;
      if (updateDto.isArchived) {
        tracking.archivedAt = new Date();
        tracking.archivedBy = updateDto.archivedBy || tracking.archivedBy || 'system';
        tracking.archivedByName = updateDto.archivedByName || tracking.archivedByName || 'Sistema';
      } else {
        tracking.unarchivedAt = new Date();
        tracking.unarchivedBy = updateDto.unarchivedBy || updateDto.archivedBy || tracking.archivedBy || 'system';
        tracking.unarchivedByName = updateDto.unarchivedByName || updateDto.archivedByName || tracking.archivedByName || 'Sistema';
      }
    }

    if (updateDto.notes !== undefined) {
      tracking.notes = updateDto.notes;
    }

    // Agregar acciones al historial
    if (actions.length > 0) {
      tracking.actions = [...tracking.actions, ...actions];
      tracking.lastAction = actions[actions.length - 1].type;
    }

    const savedTracking = await tracking.save();
    return savedTracking as any as NotificationTrackingDocument;
  }

  /**
   * Marcar como llamada realizada (isCalled = true)
   */
  async markAsCalled(
    notificationId: string, 
    userId: string, 
    userName: string,
    notes?: string
  ): Promise<NotificationTrackingDocument> {
    const tracking = await this.findLatestByNotificationId(notificationId);
    
    if (tracking.isCalled) {
      throw new BadRequestException('La notificación ya fue marcada como llamada realizada');
    }

    const updated = await this.update(tracking._id as string, {
      isCalled: true,
      calledBy: userId,
      calledByName: userName,
      notes: notes || tracking.notes || undefined
    });

    return updated as any as NotificationTrackingDocument;
  }

  /**
   * Reportar problema en la notificación
   */
  async reportProblem(
    notificationId: string,
    userId: string,
    userName: string,
    problemDescription: string,
    notes?: string
  ): Promise<NotificationTrackingDocument> {
    const tracking = await this.findLatestByNotificationId(notificationId);
    
    const updated = await this.update(tracking._id as string, {
      hasProblems: true,
      problemDescription,
      problemReportedBy: userId,
      problemReportedByName: userName,
      notes: notes || tracking.notes || undefined
    });

    return updated as any as NotificationTrackingDocument;
  }

  /**
   * Archivar o desarchivar una notificación
   */
  async toggleArchive(
    notificationId: string,
    userId: string,
    userName: string,
    archive: boolean
  ): Promise<NotificationTrackingDocument> {
    const tracking = await this.findLatestByNotificationId(notificationId);
    
    const updateData: any = {
      isArchived: archive,
      archivedBy: userId,
      archivedByName: userName,
    };

    if (!archive) {
      updateData.unarchivedBy = userId;
      updateData.unarchivedByName = userName;
    }

    const updated = await this.update(tracking._id as string, updateData);
    return updated as any as NotificationTrackingDocument;
  }

  /**
   * Agregar nota a una notificación
   */
  async addNote(
    notificationId: string,
    userId: string,
    userName: string,
    notes: string
  ): Promise<NotificationTrackingDocument> {
    const tracking = await this.findLatestByNotificationId(notificationId);
    
    const updated = await this.update(tracking._id as string, {
      notes,
      calledBy: userId,
      calledByName: userName
    });

    return updated as any as NotificationTrackingDocument;
  }

  /**
   * Eliminar tracking (solo para administración)
   */
  async remove(id: string): Promise<void> {
    const result = await this.trackingModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Tracking with id ${id} not found`);
    }
  }
}