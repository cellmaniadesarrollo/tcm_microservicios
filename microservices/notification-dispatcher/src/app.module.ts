import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NotificationsModule } from './notifications/notifications.module';
import { MailModule } from './mail/mail.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { KafkaListenersOrchestrator } from './kafka/kafka-listeners.orchestrator';
import { KafkaModule } from './kafka/kafka.module';
import { CompaniesModule } from './companies/companies.module';
import { OrdersRelayModule } from './orders-relay/orders-relay.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersEventsModule } from './customers-events/customers-events.module';

@Module({
  controllers: [AppController],
  providers: [AppService,
    KafkaListenersOrchestrator
  ],
  imports: [TypeOrmModule.forRoot({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    autoLoadEntities: true,
    synchronize: true,
  }), NotificationsModule,
    MailModule,
    WhatsappModule,
    KafkaModule,
    CustomersEventsModule,
    CompaniesModule,
    OrdersRelayModule
  ],
})
export class AppModule { }
