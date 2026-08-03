//microservices\companies\src\app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesModule } from './companies/companies.module';
import { BranchesModule } from './branches/branches.module';
import { UsersModule } from './users/users.module';
import { BroadcastModule } from './broadcast/broadcast.module';

import { HealthModule } from './health/health.module';
import { KafkaModule } from './kafka/kafka.module';
import { KafkaListenersOrchestrator } from './kafka/kafka-listeners.orchestrator';

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
    }), CompaniesModule, BranchesModule, UsersModule, BroadcastModule, HealthModule, KafkaModule,],
  controllers: [AppController],
  providers: [AppService, KafkaListenersOrchestrator],
})
export class AppModule { }
