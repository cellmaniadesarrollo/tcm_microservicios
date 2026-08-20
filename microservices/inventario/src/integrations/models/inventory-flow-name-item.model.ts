// microservicio-inventario/src/integrations/models/inventory-flow-name-item.model.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ 
  collection: 'inventoryfownameitems', 
  timestamps: true 
})
export class InventoryFlowNameItem extends Document {
  @Prop({ 
    type: String, 
    uppercase: true, 
    required: true, 
    unique: true 
  })
  name_nameitems: string;
}

export const InventoryFlowNameItemSchema = SchemaFactory.createForClass(InventoryFlowNameItem);