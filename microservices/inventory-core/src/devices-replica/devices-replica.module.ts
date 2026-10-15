import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
// Ajusta este import al módulo que exporta KafkaConsumerService en tu MS
import { KafkaModule } from '../kafka/kafka.module';

import { Brand } from './entities/brand.entity';
import { Model } from './entities/model.entity';
import { ModelTechnicalCode } from './entities/model-technical-code.entity';
import { CatalogsEventsListener } from './devices-events.listener';
import { ModelsSyncService } from './models-sync.service';
import { TechnicalModelsSyncService } from './technical-models-sync.service';

@Module({
    imports: [
        ConfigModule,
        KafkaModule,
        TypeOrmModule.forFeature([Brand, Model, ModelTechnicalCode]),
        // Ajusta urls/queue a como ya registras SCRAPER_RPC hoy
        ClientsModule.register([
            // ...tus clientes actuales,
            {
                name: 'SCRAPER_RPC',
                transport: Transport.RMQ,
                options: {
                    urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
                    queue: 'scraper_models_queue_sync',
                    queueOptions: { durable: true },
                },
            },
        ]),
    ],
    providers: [
        TechnicalModelsSyncService, ModelsSyncService, CatalogsEventsListener
    ],
    // Por si otros módulos necesitan forzar un sync manual
    exports: [CatalogsEventsListener],
})
export class DevicesReplicaModule { }
