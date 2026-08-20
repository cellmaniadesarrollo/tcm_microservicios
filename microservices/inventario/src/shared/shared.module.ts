// microservicio-inventario/src/shared/shared.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SkuGeneratorHelper } from '../integrations/helpers/sku-generator.helper';
import { BatchCounterHelper } from '../integrations/helpers/batch-counter.helper'; // ✅ AGREGAR
import { Counters, CountersSchema } from '../integrations/models/counters.model';
import { CounterBatch, CounterBatchSchema } from '../integrations/models/counter-batch.model'; // ✅ AGREGAR

@Module({
  imports: [
    MongooseModule.forFeature(
      [
        { name: Counters.name, schema: CountersSchema },
        { name: CounterBatch.name, schema: CounterBatchSchema }, // ✅ AGREGAR
      ],
      'atlas'
    ),
  ],
  providers: [
    SkuGeneratorHelper,
    BatchCounterHelper, // ✅ AGREGAR
  ],
  exports: [
    SkuGeneratorHelper,
    BatchCounterHelper, // ✅ AGREGAR
  ],
})
export class SharedModule {}