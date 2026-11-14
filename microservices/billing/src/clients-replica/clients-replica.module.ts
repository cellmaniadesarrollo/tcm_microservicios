import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CustomerReplica } from './entities/customer-replica.entity';
import { CustomerContactReplica } from './entities/customer-contact-replica.entity';
import { BillingDataReplica } from './entities/billing-data-replica.entity';
import { CustomersReplicaService } from './services/customers-replica.service';
import { BillingReplicaService } from './services/billing-replica.service';
import { ClientsSyncService } from './services/clients-sync.service';
import { ClientsEventsListener } from './listeners/clients-events.listener';

@Module({
    imports: [
        TypeOrmModule.forFeature([CustomerReplica, CustomerContactReplica, BillingDataReplica]),
        ClientsModule.register([{
            name: 'CLIENTS_SYNC',
            transport: Transport.RMQ,
            options: {
                urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
                queue: 'customers_queue_sync',
                queueOptions: { durable: true },
                persistent: true,
            },
        }]),
    ],
    providers: [CustomersReplicaService, BillingReplicaService, ClientsSyncService, ClientsEventsListener],
    exports: [ClientsEventsListener, CustomersReplicaService, BillingReplicaService],
})
export class ClientsReplicaModule { }