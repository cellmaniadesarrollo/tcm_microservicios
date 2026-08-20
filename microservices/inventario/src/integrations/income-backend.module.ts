// microservicio-inventario/src/integrations/income-backend.module.ts

import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IncomeBackendService } from './income-backend.service';
import { IncomeBackendController } from './income-backend.controller';
import { ProductsModule } from '../products/products.module';
import { BatchCounterHelper } from './helpers/batch-counter.helper';
import { SkuGeneratorHelper } from './helpers/sku-generator.helper';

// Modelos
import { Income, IncomeSchema } from './models/income.model';
import { Batch, BatchSchema } from './models/batch.model';
import { BranchBatchStock, BranchBatchStockSchema } from './models/branch-batch-stock.model';
import { InventoryFlow, InventoryFlowSchema } from './models/inventory-flow.model';
import { CounterBatch, CounterBatchSchema } from './models/counter-batch.model';
import { Counters, CountersSchema } from './models/counters.model';
import { DocumentNumberIncome, DocumentNumberIncomeSchema } from './models/document-number-income.model';
import { InventoryFlowNameItem, InventoryFlowNameItemSchema } from './models/inventory-flow-name-item.model';
import { Color, ColorSchema } from './models/color.model';
import { Brand, BrandSchema } from './models/brand.model';
import { TypeInventoryFlow, TypeInventoryFlowSchema } from './models/type-inventory-flow.model';
import { Quality, QualitySchema } from './models/quality.model';
import { NameInventory, NameInventorySchema } from './models/name-inventory.model'; // ✅ IMPORTAR

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: Income.name, schema: IncomeSchema },
        { name: Batch.name, schema: BatchSchema },
        { name: BranchBatchStock.name, schema: BranchBatchStockSchema },
        { name: InventoryFlow.name, schema: InventoryFlowSchema },
        { name: CounterBatch.name, schema: CounterBatchSchema },
        { name: Counters.name, schema: CountersSchema },
        { name: DocumentNumberIncome.name, schema: DocumentNumberIncomeSchema },
        { name: InventoryFlowNameItem.name, schema: InventoryFlowNameItemSchema },
        { name: Color.name, schema: ColorSchema },
        { name: Brand.name, schema: BrandSchema },
        { name: TypeInventoryFlow.name, schema: TypeInventoryFlowSchema },
        { name: Quality.name, schema: QualitySchema },
        { name: NameInventory.name, schema: NameInventorySchema }, // ✅ AGREGAR
      ],
      'atlas'
    ),
    forwardRef(() => ProductsModule),
  ],
  controllers: [IncomeBackendController],
  providers: [
    IncomeBackendService,
    BatchCounterHelper,
    SkuGeneratorHelper,
  ],
  exports: [IncomeBackendService, BatchCounterHelper, SkuGeneratorHelper],
})
export class IncomeBackendModule {}