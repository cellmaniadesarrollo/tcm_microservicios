// microservicio-inventario/src/integrations/models/color.model.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ 
  collection: 'colors', 
  timestamps: true 
})
export class Color extends Document {
  @Prop({ 
    type: String, 
    uppercase: true, 
    unique: true, 
    required: true 
  })
  color_name: string;
}

export const ColorSchema = SchemaFactory.createForClass(Color);