import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InventoryMovementDocument = HydratedDocument<InventoryMovement>;

export enum MovementType {
  ENTRADA = 'ENTRADA',
  SALIDA = 'SALIDA',
  AJUSTE = 'AJUSTE',
}

@Schema({ timestamps: true, collection: 'inventory_movements' })
export class InventoryMovement {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id?: string;

  @Prop({ type: String, required: true })
  productId!: string;

  @Prop({ type: String, required: true })
  productCode!: string;

  @Prop({ type: String, required: true })
  productName!: string;

  @Prop({ type: Number, required: true })
  previousQuantity!: number;

  @Prop({ type: Number, required: true })
  newQuantity!: number;

  @Prop({ type: Number, required: true })
  quantity!: number;

  @Prop({ type: String, enum: MovementType, required: true })
  movementType!: MovementType;

  @Prop({ type: String, required: true })
  reason!: string;

  @Prop({ type: String, default: null })
  performedBy?: string;

  @Prop({ type: String, default: null })
  performedByName?: string;

  @Prop({ type: Date, default: Date.now })
  performedAt!: Date;

  @Prop({ type: String, default: null })
  relatedOrderId?: string;

  @Prop({ type: Number, default: null })
  relatedDeviceId?: number;

  @Prop({ type: String, default: null })
  observations?: string;

  @Prop({ type: Boolean, default: false })
  isDeleted!: boolean;

  @Prop({ type: Date, default: Date.now })
  createdAt!: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt!: Date;
}

export const InventoryMovementSchema = SchemaFactory.createForClass(InventoryMovement);

InventoryMovementSchema.index({ productId: 1, performedAt: -1 });
InventoryMovementSchema.index({ relatedOrderId: 1 });