// microservicio-inventario/src/integrations/models/brand.model.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ 
  collection: 'brands', 
  timestamps: true 
})
export class Brand extends Document {
  @Prop({ 
    type: String, 
    uppercase: true, 
    unique: true, 
    required: true 
  })
  name_brands: string;
}

export const BrandSchema = SchemaFactory.createForClass(Brand);