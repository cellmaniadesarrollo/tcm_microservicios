import { Module } from '@nestjs/common';
import { ReportingHubService } from './reporting-hub.service';
import { ReportingHubController } from './reporting-hub.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderValidationReplica } from './entities/order-validation-replica.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ReportingHubEventsListener } from './reporting-hub-events.listener'; 
import { ReportingHubBootstrapService } from './reporting-hub-bootstrap.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderValidationReplica]),
    ClientsModule.register([
      {
        name: 'REPORTING_HUB_ASYNC',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
          queue: 'reporting_hub_queue_sync',
          queueOptions: { durable: true },
          persistent: true,
        },
      },
    ]),
  ],
  controllers: [ReportingHubController],
  providers: [ReportingHubService, ReportingHubEventsListener,ReportingHubBootstrapService ],
  exports: [ReportingHubService, ReportingHubEventsListener,]
})
export class ReportingHubModule { }
