// src/notifications/notification-tracking.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete,
  Body, 
  Param, 
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { NotificationTrackingService } from './notification-tracking.service';
import { CreateNotificationTrackingDto } from './dto/create-notification-tracking.dto';
import { UpdateNotificationTrackingDto } from './dto/update-notification-tracking.dto';

@Controller('notifications/tracking')
export class NotificationTrackingController {
  constructor(private readonly trackingService: NotificationTrackingService) {}

  @Post()
  async create(@Body() createDto: CreateNotificationTrackingDto) {
    return this.trackingService.create(createDto);
  }

  @Get('notification/:notificationId')
  async findByNotificationId(@Param('notificationId') notificationId: string) {
    return this.trackingService.findByNotificationId(notificationId);
  }

  @Get('notification/:notificationId/latest')
  async findLatest(@Param('notificationId') notificationId: string) {
    return this.trackingService.findLatestByNotificationId(notificationId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateNotificationTrackingDto
  ) {
    return this.trackingService.update(id, updateDto);
  }

  @Post('notification/:notificationId/call')
  async markAsCalled(
    @Param('notificationId') notificationId: string,
    @Body() body: { userId: string; userName: string; notes?: string }
  ) {
    return this.trackingService.markAsCalled(
      notificationId,
      body.userId,
      body.userName,
      body.notes
    );
  }

  @Post('notification/:notificationId/problem')
  async reportProblem(
    @Param('notificationId') notificationId: string,
    @Body() body: { 
      userId: string; 
      userName: string; 
      problemDescription: string; 
      notes?: string 
    }
  ) {
    return this.trackingService.reportProblem(
      notificationId,
      body.userId,
      body.userName,
      body.problemDescription,
      body.notes
    );
  }

  @Post('notification/:notificationId/archive')
  async toggleArchive(
    @Param('notificationId') notificationId: string,
    @Body() body: { userId: string; userName: string; archive: boolean }
  ) {
    return this.trackingService.toggleArchive(
      notificationId,
      body.userId,
      body.userName,
      body.archive
    );
  }

  @Post('notification/:notificationId/note')
  async addNote(
    @Param('notificationId') notificationId: string,
    @Body() body: { userId: string; userName: string; notes: string }
  ) {
    return this.trackingService.addNote(
      notificationId,
      body.userId,
      body.userName,
      body.notes
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.trackingService.remove(id);
  }
}