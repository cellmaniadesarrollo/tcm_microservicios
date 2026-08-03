import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CustomersModule } from './customers/customers.module';
import { BillingModule } from './billing/billing.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BroadcastModule } from './broadcast/broadcast.module';
import { CompaniesModule } from './companies/companies.module';
import { KafkaModule } from './kafka/kafka.module';
import { HealthModule } from './health/health.module';
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
    }), CustomersModule, BillingModule, CatalogsModule, BroadcastModule, CompaniesModule, KafkaModule, HealthModule,],
  controllers: [AppController],
  providers: [AppService, KafkaListenersOrchestrator],
})
export class AppModule { }
