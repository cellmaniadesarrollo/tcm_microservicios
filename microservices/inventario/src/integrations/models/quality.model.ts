// microservicio-inventario/src/integrations/models/quality.model.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ 
  collection: 'qualityinventoryflows', 
  timestamps: true 
})
export class Quality extends Document {
  @Prop({ 
    type: String, 
    uppercase: true, 
    unique: true, 
    required: true 
  })
  quality_inventoryflow: string;
}

export const QualitySchema = SchemaFactory.createForClass(Quality);