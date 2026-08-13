// microservicio-inventario/src/integrations/models/counter-batch.model.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ 
  collection: 'counterbatches', 
  timestamps: true 
})
export class CounterBatch extends Document {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: Types.ObjectId, ref: 'inventoryflows', required: true })
  item: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  seq: number;
}

export const CounterBatchSchema = SchemaFactory.createForClass(CounterBatch);