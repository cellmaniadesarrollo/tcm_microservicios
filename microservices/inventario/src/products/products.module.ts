// microservicio-inventario/src/products/products.module.ts

import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Product, ProductSchema } from './entities/product.entity';
import { IncomeBackendModule } from '../integrations/income-backend.module';
import { SharedModule } from '../shared/shared.module'; // ✅ IMPORTAR

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Product.name, schema: ProductSchema }],
      'default'
    ),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    forwardRef(() => IncomeBackendModule),
    SharedModule, // ✅ AGREGAR
  ],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    // ❌ ELIMINAR SkuGeneratorHelper de providers (viene de SharedModule)
  ],
  exports: [ProductsService],
})
export class ProductsModule {}