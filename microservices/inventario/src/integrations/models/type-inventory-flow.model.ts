// microservicio-inventario/src/integrations/models/type-inventory-flow.model.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ 
  collection: 'typeinventoryflows', 
  timestamps: true 
})
export class TypeInventoryFlow extends Document {
  @Prop({ 
    type: String, 
    uppercase: true, 
    unique: true, 
    required: true 
  })
  type_inventoryflow: string;
}

export const TypeInventoryFlowSchema = SchemaFactory.createForClass(TypeInventoryFlow);