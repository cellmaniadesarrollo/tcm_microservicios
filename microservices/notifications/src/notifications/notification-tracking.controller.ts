// src/notifications/notification-tracking.controller.ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { NotificationTrackingService } from './notification-tracking.service';
import { CreateNotificationTrackingDto } from './dto/create-notification-tracking.dto';
import { UpdateNotificationTrackingDto } from './dto/update-notification-tracking.dto';

@Controller()
export class NotificationTrackingController {
  constructor(private readonly trackingService: NotificationTrackingService) {}

  @MessagePattern({ cmd: 'create_notification_tracking' })
  async create(@Payload() createDto: CreateNotificationTrackingDto) {
    return this.trackingService.create(createDto);
  }

  @MessagePattern({ cmd: 'get_notification_tracking_history' })
  async findByNotificationId(@Payload() data: { notificationId: string }) {
    return this.trackingService.findByNotificationId(data.notificationId);
  }

  @MessagePattern({ cmd: 'get_latest_notification_tracking' })
  async findLatest(@Payload() data: { notificationId: string }) {
    return this.trackingService.findLatestByNotificationId(data.notificationId);
  }

  @MessagePattern({ cmd: 'update_notification_tracking' })
  async update(@Payload() data: { id: string } & UpdateNotificationTrackingDto) {
    const { id, ...updateDto } = data;
    return this.trackingService.update(id, updateDto);
  }

  @MessagePattern({ cmd: 'mark_as_called' })
  async markAsCalled(
    @Payload() data: { notificationId: string; userId: string; userName: string; notes?: string }
  ) {
    return this.trackingService.markAsCalled(
      data.notificationId,
      data.userId,
      data.userName,
      data.notes
    );
  }

  @MessagePattern({ cmd: 'report_problem' })
  async reportProblem(
    @Payload() data: { 
      notificationId: string; 
      userId: string; 
      userName: string; 
      problemDescription: string; 
      notes?: string 
    }
  ) {
    return this.trackingService.reportProblem(
      data.notificationId,
      data.userId,
      data.userName,
      data.problemDescription,
      data.notes
    );
  }

  // 🔴 ESTE ES EL QUE TE FALTABA
  @MessagePattern({ cmd: 'mark_as_does_not_apply' })
  async setDoesNotApply(
    @Payload() data: { notificationId: string; userId: string }
  ) {
    return this.trackingService.setDoesNotApply(
      data.notificationId,
      data.userId
    );
  }

  @MessagePattern({ cmd: 'toggle_archive' })
  async toggleArchive(
    @Payload() data: { notificationId: string; userId: string; userName: string; archive: boolean }
  ) {
    return this.trackingService.toggleArchive(
      data.notificationId,
      data.userId,
      data.userName,
      data.archive
    );
  }

  @MessagePattern({ cmd: 'add_note_to_notification' })
  async addNote(
    @Payload() data: { notificationId: string; userId: string; userName: string; notes: string }
  ) {
    return this.trackingService.addNote(
      data.notificationId,
      data.userId,
      data.userName,
      data.notes
    );
  }

  @MessagePattern({ cmd: 'delete_notification_tracking' })
  async remove(@Payload() data: { id: string }) {
    return this.trackingService.remove(data.id);
  }
}