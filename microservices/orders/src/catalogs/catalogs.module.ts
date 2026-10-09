import { Module } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';
import { CatalogsController } from './catalogs.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MysqlRawModule } from '../mysql-raw/mysql-raw.module';
import { Brand } from './entities/brand.entity';
import { Model } from './entities/model.entity';
import { DeviceType } from './entities/device_type.entity';
import { OrderPriority } from './entities/order-priority.entity';
import { OrderType } from './entities/order-type.entity';
import { OrderStatus } from './entities/order_status.entity';
import { GeoCountry } from './entities/geo-country.entity';
import { GeoDivision } from './entities/geo-division.entity';
import { CatalogsSeeder } from './seeders/catalogs.seeder';
import { ScheduleModule } from '@nestjs/schedule';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TechnicalModelsSyncService } from './technical-models-sync.service';
import { ModelTechnicalCode } from './entities/model-technical-code.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Brand, Model, DeviceType, OrderPriority, OrderType, OrderStatus,
    GeoCountry,
    GeoDivision, ModelTechnicalCode
  ]), MysqlRawModule,
  ScheduleModule.forRoot(),
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
  providers: [CatalogsService, CatalogsSeeder, TechnicalModelsSyncService,],
  controllers: [CatalogsController],

})
export class CatalogsModule { }
