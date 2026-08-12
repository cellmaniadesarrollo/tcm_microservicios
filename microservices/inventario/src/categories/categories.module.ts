// microservicio-inventario/src/categories/categories.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoriesService } from './categories.service';
import { Category, CategorySchema } from './entities/category.entity';

@Module({
  imports: [
    // ✅ Usar conexión por defecto (default)
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema }
    ]),
  ],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}