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
import { Counters, CountersSchema } from './models/counters.model'; // ✅ Importar
import { DocumentNumberIncome, DocumentNumberIncomeSchema } from './models/document-number-income.model';
import { InventoryFlowNameItem, InventoryFlowNameItemSchema } from './models/inventory-flow-name-item.model';

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: Income.name, schema: IncomeSchema },
        { name: Batch.name, schema: BatchSchema },
        { name: BranchBatchStock.name, schema: BranchBatchStockSchema },
        { name: InventoryFlow.name, schema: InventoryFlowSchema },
        { name: CounterBatch.name, schema: CounterBatchSchema },
        { name: Counters.name, schema: CountersSchema }, // ✅ AGREGAR Counters
        { name: DocumentNumberIncome.name, schema: DocumentNumberIncomeSchema },
        { name: InventoryFlowNameItem.name, schema: InventoryFlowNameItemSchema },
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