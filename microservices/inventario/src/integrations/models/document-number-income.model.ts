// microservicio-inventario/src/integrations/models/document-number-income.model.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ 
  collection: 'documentnumberincomes', 
  timestamps: true 
})
export class DocumentNumberIncome extends Document {
  @Prop({ type: String, required: true })
  document_number: string;

  @Prop({ type: Types.ObjectId, required: true })
  document_type: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  id_supplier: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  id_tax_percentaje: Types.ObjectId;
}

export const DocumentNumberIncomeSchema = SchemaFactory.createForClass(DocumentNumberIncome);