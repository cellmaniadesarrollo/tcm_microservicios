import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductCatalogsModule } from '../product-catalogs/product-catalogs.module';

@Module({
  imports: [ProductCatalogsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule { }
