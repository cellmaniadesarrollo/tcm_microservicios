// microservicio-inventario/src/integrations/models/branch-batch-stock.model.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ 
  collection: 'branchbatchstocks', 
  timestamps: true 
})
export class BranchBatchStock extends Document {
  @Prop({ type: Types.ObjectId, ref: 'batches', required: true })
  batchId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'branches', required: true })
  branchId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'nameinventorys', required: true })
  id_name_inventory: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'inventoryflows', required: true })
  last_item_id: Types.ObjectId;

  @Prop({ type: String, required: true })
  branchName: string;

  @Prop({ type: Number, min: 0, default: 0, required: true })
  quantity: number;

  @Prop({ type: Boolean, default: false, required: true })
  isWarehouse: boolean;

  @Prop({ type: String, enum: ['active', 'inactive'], default: 'active' })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'branchBatchStockMovements' })
  lastMovementId: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  lastUpdatedAt: Date;
}

export const BranchBatchStockSchema = SchemaFactory.createForClass(BranchBatchStock);