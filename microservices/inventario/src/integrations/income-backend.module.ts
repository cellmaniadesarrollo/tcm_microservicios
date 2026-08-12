// microservicio-inventario/src/integrations/income-backend.module.ts

import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IncomeBackendService } from './income-backend.service';
import { IncomeBackendController } from './income-backend.controller';
import { Income, IncomeSchema } from './models/income.model';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    // ✅ Usar conexión "atlas" para incomes
    MongooseModule.forFeature(
      [{ name: 'Income', schema: IncomeSchema }],
      'atlas' // 👈 Especificar la conexión
    ),
    forwardRef(() => ProductsModule),
  ],
  controllers: [IncomeBackendController],
  providers: [IncomeBackendService],
  exports: [IncomeBackendService],
})
export class IncomeBackendModule {}