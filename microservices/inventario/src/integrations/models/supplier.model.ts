// microservicio-inventario/src/integrations/models/supplier.model.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ 
  collection: 'suppliers', 
  timestamps: true 
})
export class Supplier extends Document {
  @Prop({ type: String })
  ruc: string;

  @Prop({ type: String, required: true, unique: true, uppercase: true })
  razon_social: string;

  @Prop({ type: String })
  address: string;

  @Prop({ type: String })
  phone: string;

  @Prop({ type: String })
  email: string;

  @Prop({ type: Types.ObjectId, required: true })
  rimpe: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  countrie: Types.ObjectId;
}

export const SupplierSchema = SchemaFactory.createForClass(Supplier);