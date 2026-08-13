// microservicio-inventario/src/products/products.module.ts

import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Product, ProductSchema } from './entities/product.entity';
import { IncomeBackendModule } from '../integrations/income-backend.module';

@Module({
  imports: [
    // ✅ CORREGIDO: Usar conexión 'default'
    MongooseModule.forFeature(
      [{ name: Product.name, schema: ProductSchema }],
      'default'
    ),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    forwardRef(() => IncomeBackendModule),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}