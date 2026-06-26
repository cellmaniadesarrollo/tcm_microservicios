// src/spare-assignments/spare-assignments.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { SpareAssignment } from './entities/spare-assignment.entity';
import { SpareAssignmentsService } from './spare-assignments.service';
import { SpareAssignmentsEventsListener } from './spare-assignments-events.listener';
import { SpareAssignmentsController } from './spare-assignments.controller';
import { SpareAssignmentsSyncController } from './spare-assignments-sync.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SpareAssignment]),
    ClientsModule.register([
      {
        name: 'SPARE_ASSIGNMENTS_SYNC',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
          queue: 'spare_assignments_queue_sync',
          queueOptions: { durable: true },
          persistent: true,
        },
      },
    ]),  
  ],
  controllers: [SpareAssignmentsController, SpareAssignmentsSyncController],
  providers: [SpareAssignmentsService, SpareAssignmentsEventsListener],
  exports: [SpareAssignmentsEventsListener],
})
export class SpareAssignmentsModule { }