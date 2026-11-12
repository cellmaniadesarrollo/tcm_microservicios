import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductCatalogsModule } from '../product-catalogs/product-catalogs.module';
import { AwsS3Module } from '../aws-s3/aws-s3.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductImage } from './entities/product-image.entity';
import { ProductImagesController } from './images/product-images.controller';
import { ProductImagesService } from './images/product-images.service';
import { ProductModel } from './entities/product-model.entity';
import { Product } from './entities/product.entity';
import { ProductName } from '../product-catalogs/entities/product-name.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ProductUsage } from '../product-catalogs/entities/product-usage.entity';
import { ProductUsageLink } from './entities/product-usage-link.entity';
import { StockUnitSerial } from '../stock/entities/stock-unit-serial.entity';
import { ProductListQuery } from './queries/product-list.query';
import { ProductDetailQuery } from './queries/product-detail.query';
import { ReceiptSearchQuery } from './queries/receipt-search.query';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [
    ProductCatalogsModule,
    AwsS3Module,
    TypeOrmModule.forFeature([ProductImage, ProductModel, Product, ProductName, ProductUsageLink, StockUnitSerial]), // registra la entidad si usas autoLoadEntities
    AuditLogModule,
    OutboxModule
  ],
  controllers: [ProductsController, ProductImagesController],
  providers: [ProductsService,
    ProductListQuery,
    ProductDetailQuery,
    ReceiptSearchQuery, ProductImagesService],
  exports: [ProductsService],
})
export class ProductsModule { }
