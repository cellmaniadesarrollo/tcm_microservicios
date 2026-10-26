import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from './entities/address.entity';
import { Contact } from './entities/contact.entity';
import { Customer } from './entities/customer.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { BroadcastModule } from '../broadcast/broadcast.module';
import { KafkaModule } from '../kafka/kafka.module';
import { AuditModule } from '../audit/audit.module';
import { OrdersPinService } from '../pin/orders-pin.service';

@Module({
  imports: [
    KafkaModule,
    TypeOrmModule.forFeature([Address, Contact, Customer]),
    BroadcastModule,
    AuditModule, // 🆕 debe exportar AuditService
    ClientsModule.register([
      {
        name: 'USERS_SERVICE',
        transport: Transport.RMQ, // 🆕 era TCP
        options: {
          urls: [process.env.RABBITMQ_URL ?? 'amqp://rabbitmq:5672'],
          queue: 'users_queue', // ⚠️ confirma el nombre real en users/src/main.ts
          queueOptions: { durable: false },
        },
      },
    ]),
  ],
  providers: [CustomersService, OrdersPinService],
  controllers: [CustomersController],
  exports: [OrdersPinService], // 🆕 por si lo usa el módulo de billing
})
export class CustomersModule {}