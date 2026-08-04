// src/legacy/legacy.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { LegacyController } from './legacy.controller';
import { LegacyService } from './legacy.service';
import { LegacyJwtStrategy } from './legacy-jwt.strategy/legacy-jwt.strategy';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'CUSTOMERS_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://rabbitmq:5672'],
          queue: 'customers_queue',
          queueOptions: { durable: false },
        },
      },
    ]),
  ],
  controllers: [LegacyController],
  providers: [LegacyService, LegacyJwtStrategy],
  exports: [LegacyService],
})
export class LegacyModule { }