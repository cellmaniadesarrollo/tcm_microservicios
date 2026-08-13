// microservicio-inventario/src/integrations/models/inventory-flow.model.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ 
  collection: 'inventoryflows', 
  timestamps: true 
})
export class InventoryFlow extends Document {
  @Prop({ type: String, required: true })
  upc: string;

  @Prop({ type: String, required: true })
  sku: string;

  @Prop({ type: Types.ObjectId, required: true })
  id_name_items: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  id_model: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  id_color: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  id_quality: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  last_unit_price_income: number;

  // Campos redundantes
  @Prop({ type: String })
  name_model: string;

  @Prop({ type: String })
  name_color: string;

  @Prop({ type: String })
  name_quality: string;

  @Prop({ type: String })
  name_nameitems: string;

  @Prop({ type: String, default: '0.00' })
  item_price: string;

  @Prop({ type: Types.ObjectId, required: true })
  id_stateproduct_inventoryflow: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  id_state: Types.ObjectId;

  @Prop({ type: String })
  observations: string;

  @Prop({ type: Types.ObjectId, required: true })
  id_type: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  id_type_inventory: Types.ObjectId;
}

export const InventoryFlowSchema = SchemaFactory.createForClass(InventoryFlow);