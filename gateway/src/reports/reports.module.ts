import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AuthModule } from '../common/auth/auth.module';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'REPORT_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://rabbitmq:5672'],
          queue: 'reports_queue',
          queueOptions: { durable: false },
        },
      },
    ]),
    JwtModule, SubscriptionsModule, AuthModule
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule { }
