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

@Module({
  imports:[TypeOrmModule.forFeature([Brand,Model,DeviceType,OrderPriority,OrderType,OrderStatus]),MysqlRawModule],
  providers: [CatalogsService],
  controllers: [CatalogsController], 

})
export class CatalogsModule { }
