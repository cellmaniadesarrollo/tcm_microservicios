// microservicio-inventario/src/integrations/models/income.model.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ 
  collection: 'incomes', 
  timestamps: true 
})
export class Income extends Document {
  @Prop({ type: String, default: '0' })
  unit_price: string;

  @Prop({ type: String, default: '0' })
  unit_sales_price: string;

  @Prop({ type: String, default: '' })
  observations: string;

  @Prop({ type: Number, required: true, default: 1 })
  quantity: number;

  @Prop({ type: Date, required: true, default: Date.now })
  date_income: Date;

  @Prop({ type: Types.ObjectId, required: true })
  id_document_number: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  id_item: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  id_coduuid: Types.ObjectId;

  @Prop({ type: String, default: 'ordenes' })
  user_create: string;

  @Prop({ type: Types.ObjectId, required: true })
  id_status: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  batch_id: Types.ObjectId;

  @Prop({
    type: {
      batchNumber: { type: Number },
      identifiers: { type: [String], default: [] }
    },
    default: {}
  })
  batch_snapshot: {
    batchNumber: number;
    identifiers: string[];
  };

  @Prop({
    type: {
      inventory_id: { type: Types.ObjectId, required: true },
      inventory_name: { type: String, required: true },
      sku: { type: String },
      upc: { type: String },
      name_item: { type: String },
      name_model: { type: String },
      name_color: { type: String },
      name_quality: { type: String }
    },
    required: true
  })
  inventory_snapshot: {
    inventory_id: Types.ObjectId;
    inventory_name: string;
    sku?: string;
    upc?: string;
    name_item?: string;
    name_model?: string;
    name_color?: string;
    name_quality?: string;
  };
}

export const IncomeSchema = SchemaFactory.createForClass(Income);