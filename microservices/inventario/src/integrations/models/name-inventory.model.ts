// microservicio-inventario/src/integrations/models/name-inventory.model.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ 
  collection: 'nameinventorys', 
  timestamps: true 
})
export class NameInventory extends Document {
  @Prop({ 
    type: String, 
    unique: true, 
    required: true, 
    uppercase: true 
  })
  inventory_name: string;
}

export const NameInventorySchema = SchemaFactory.createForClass(NameInventory);