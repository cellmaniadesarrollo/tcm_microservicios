import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule'; // ← AGREGAR
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { ReminderModule } from './reminders/reminder.module';
import { KafkaModule } from './kafka/kafka.module';
import { OrdersRelayModule } from './orders-relay/orders-relay.module';
import { KafkaListenersOrchestrator } from './kafka/kafka-listeners.orchestrator';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(), // ← AGREGAR (para los recordatorios con cron)
    MongooseModule.forRootAsync({
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    NotificationsModule,
    AuditModule,
    HealthModule,
    ReminderModule, // ← AGREGAR
    KafkaModule,
    OrdersRelayModule
  ],
  providers:[KafkaListenersOrchestrator]
})
export class AppModule {}