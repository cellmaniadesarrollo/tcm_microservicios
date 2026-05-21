import { Module } from '@nestjs/common';
import { TaskboardController } from './taskboard.controller';
import { TaskboardService } from './taskboard.service';

@Module({
  controllers: [TaskboardController],
  providers: [TaskboardService],
})
export class TaskboardModule {}