// microservicio-inventario/src/shared/shared.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SkuGeneratorHelper } from '../integrations/helpers/sku-generator.helper';
import { Counters, CountersSchema } from '../integrations/models/counters.model';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Counters.name, schema: CountersSchema }],
      'atlas'
    ),
  ],
  providers: [SkuGeneratorHelper],
  exports: [SkuGeneratorHelper],
})
export class SharedModule {}