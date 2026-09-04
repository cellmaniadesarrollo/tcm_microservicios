// microservicio-inventario/src/integrations/models/batch.model.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ 
  collection: 'batches', 
  timestamps: true 
})
export class Batch extends Document {
  @Prop({ type: Number, index: true })
  batchNumber: number;

  @Prop({ type: Types.ObjectId, ref: 'inventoryflows', required: true })
  item: Types.ObjectId;

  @Prop({ type: String, index: true })
  productName: string;

  @Prop({ type: String, required: true })
  sku: string;

  @Prop({ type: Number, required: true })
  unitPrice: number;

  @Prop({ type: Boolean, default: true })
  hasTax: boolean;

  @Prop({ 
    type: String, 
    enum: ['yes', 'no', 'optional'], 
    default: 'no',
    required: true 
  })
  isBillable: string;

  @Prop({ type: [Types.ObjectId], ref: 'incomes', default: [] })
  legacy_incomes_id: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'incomes' })
  incomes_id: Types.ObjectId;

  @Prop({
    type: [{ code: { type: String, index: true } }],
    default: []
  })
  identifiers: { code: string }[];

  @Prop({ type: String })
  notes: string;

  @Prop({ type: String, index: true })
  orderPublicId: string;

  // ✅ ARRAY DE VERIFICACIONES (una por cada parte)
  @Prop({ type: [Types.ObjectId], ref: 'deviceverifications', default: [] })
  deviceVerificationIds: Types.ObjectId[];

  // ✅ INDICADOR DE SI ES UN DISPOSITIVO COMPLETO
  @Prop({ type: Boolean, default: false })
  isCompleteDevice: boolean;
}

export const BatchSchema = SchemaFactory.createForClass(Batch);