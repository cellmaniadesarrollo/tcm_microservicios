// microservicio-inventario/src/integrations/models/counters.model.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ 
  collection: 'counters', 
  timestamps: true 
})
export class Counters extends Document {
  @Prop({ type: String, unique: true, required: true })
  schemaname: string;

  @Prop({ type: Number, required: true })
  sequence_value: number;
}

export const CountersSchema = SchemaFactory.createForClass(Counters);