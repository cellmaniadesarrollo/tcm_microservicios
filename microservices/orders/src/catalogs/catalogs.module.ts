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

@Module({
  imports: [TypeOrmModule.forFeature([Brand, Model, DeviceType, OrderPriority, OrderType, OrderStatus,
    GeoCountry,
    GeoDivision,
  ]), MysqlRawModule],
  providers: [CatalogsService, CatalogsSeeder],
  controllers: [CatalogsController],

})
export class CatalogsModule { }
