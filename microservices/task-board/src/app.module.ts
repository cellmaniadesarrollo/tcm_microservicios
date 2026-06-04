import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BoardsModule } from './boards/boards.module';
import { TasksModule } from './tasks/tasks.module';
import { LabelsModule } from './labels/labels.module';
import { KafkaModule } from './kafka/kafka.module';
import { HealthModule } from './health/health.module';
import { KafkaListenersOrchestrator } from './kafka/kafka-listeners.orchestrator';
import { AwsS3Module } from './aws-s3/aws-s3.module';
import { ImagesModule } from './images/images.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: true,
    }),
    KafkaModule,
    HealthModule,
    BoardsModule,
    TasksModule,
    LabelsModule,
    AwsS3Module,
    ImagesModule
  ],
  controllers: [AppController],
  providers: [AppService],
}) 
export class AppModule {}