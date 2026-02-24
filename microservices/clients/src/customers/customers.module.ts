import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from './entities/address.entity';
import { Contact } from './entities/contact.entity';
import { Customer } from './entities/customer.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { BroadcastModule } from '../broadcast/broadcast.module';
@Module({
  imports: [TypeOrmModule.forFeature([Address, Contact, Customer]),
 
  
 BroadcastModule,
  ],
  providers: [CustomersService],
  controllers: [CustomersController]
})
export class CustomersModule { }
