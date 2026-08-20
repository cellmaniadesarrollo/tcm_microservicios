// microservicio-inventario/src/integrations/models/counter-batch.model.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ 
  collection: 'counterbatches' 
})
export class CounterBatch extends Document {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: Number, default: 0 })
  seq: number;

  @Prop({ type: Types.ObjectId })
  item: Types.ObjectId;
}

export const CounterBatchSchema = SchemaFactory.createForClass(CounterBatch);