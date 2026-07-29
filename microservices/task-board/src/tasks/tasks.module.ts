// tasks/tasks.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { Task } from './entities/task.entity';
import { TaskCollaboratorsService } from './task-collaborators.service';
import { TaskCollaborator } from './entities/task-collaborator.entity';
import { TaskComment } from './entities/task-comment.entity';
import { SubTask } from './entities/subtask.entity';
import { TaskCommentsService } from './task-comments.service';
import { SubTasksService } from './subtasks.service';
import { NotificationsModule } from '../notifications/notifications.module'; 
import { BoardColumn } from '../boards/entities/board-column.entity';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskCollaborator, TaskComment, SubTask, BoardColumn]),
    NotificationsModule,
    forwardRef(() => PushNotificationsModule),
  ],
  controllers: [TasksController],
  providers: [
    TasksService,
    TaskCollaboratorsService,
    TaskCommentsService,
    SubTasksService,
  ],
  exports: [TasksService],
})
export class TasksModule {}