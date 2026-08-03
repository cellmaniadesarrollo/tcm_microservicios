import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { OrdersReportsModule } from './orders-reports/orders-reports.module';
import { MongooseModule } from '@nestjs/mongoose';
import { CompaniesModule } from './companies/companies.module';
import { KafkaModule } from './kafka/kafka.module';
import { KafkaListenersOrchestrator } from './kafka/kafka-listeners.orchestrator';
import { UsersEmployeesEventsModule } from './users-employees-events/users-employees-events.module';
import { OrdersRelayModule } from './orders-relay/orders-relay.module';
import { OrderValidationModule } from './order-validation/order-validation.module';
import { PrintModule } from './print/print.module';
import { FinesModule } from './fines/fines.module';

@Module({
  imports: [MongooseModule.forRoot(process.env.MONGODB_URI || "mongodb://localhost:27017/", {
    dbName: process.env.DB_NAME,
  }), HealthModule, OrdersReportsModule, CompaniesModule, KafkaModule, UsersEmployeesEventsModule, OrdersRelayModule, OrderValidationModule, PrintModule, FinesModule],
  controllers: [AppController],
  providers: [AppService, KafkaListenersOrchestrator],
})
export class AppModule { }
