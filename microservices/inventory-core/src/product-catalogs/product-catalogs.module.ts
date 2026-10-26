import { Module } from '@nestjs/common';
import { ProductCatalogsService } from './product-catalogs.service';
import { ProductCatalogsController } from './product-catalogs.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyReplica } from '../companies/entities/company-replica.entity';
import { ProductType } from './entities/product-type.entity';
import { Color } from './entities/color.entity';
import { Quality } from './entities/quality.entity';
import { Brand } from '../devices-replica/entities/brand.entity';
import { ProductUsage } from './entities/product-usage.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyReplica, ProductType, Color, Quality, Brand, ProductUsage])],
  controllers: [ProductCatalogsController],
  providers: [ProductCatalogsService],
  exports: [ProductCatalogsService]
})
export class ProductCatalogsModule { }
