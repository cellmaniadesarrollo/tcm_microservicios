import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { KafkaModule } from './kafka/kafka.module';
import { CompaniesModule } from './companies/companies.module';
import { KafkaListenersOrchestrator } from './kafka/kafka-listeners.orchestrator';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersEventsModule } from './customers-events/customers-events.module';

@Module({
  imports: [TypeOrmModule.forRoot({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    autoLoadEntities: true,
    synchronize: true,
  }), HealthModule, KafkaModule, CompaniesModule, CustomersEventsModule],
  controllers: [AppController],
  providers: [AppService, KafkaListenersOrchestrator],
})
export class AppModule { }
