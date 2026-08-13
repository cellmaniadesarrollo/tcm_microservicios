// microservicio-inventario/src/integrations/helpers/batch-counter.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BatchCounterHelper } from './batch-counter.helper';
import { CounterBatch, CounterBatchSchema } from '../models/counter-batch.model';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: CounterBatch.name, schema: CounterBatchSchema }],
      'atlas'
    ),
  ],
  providers: [BatchCounterHelper],
  exports: [BatchCounterHelper],
})
export class BatchCounterModule {}