// microservicio-inventario/src/integrations/models/device-verification.model.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ 
  collection: 'device_verifications', 
  timestamps: true 
})
export class DeviceVerification extends Document {
  // ✅ CAMPOS DE RELACIÓN
  @Prop({ type: Types.ObjectId, ref: 'batches', required: true, index: true })
  batchId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'incomes', required: true, index: true })
  incomeId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'inventoryflows', required: true, index: true })
  inventoryFlowId: Types.ObjectId;

  // ✅ DATOS BÁSICOS DE LA PARTE
  @Prop({ type: Number, required: true, index: true })
  deviceId: number;

  @Prop({ type: String })
  customerName: string;

  @Prop({ type: String })
  customerId: string;

  @Prop({ type: String, required: true, index: true })
  partName: string;

  @Prop({ type: String })
  partLabel: string;

  @Prop({ type: String, enum: ['BUENA', 'MALA', 'N/A'], required: true })
  status: 'BUENA' | 'MALA' | 'N/A';

  @Prop({ type: Number })
  value: number | null;

  @Prop({ type: String })
  observation: string;

  @Prop({ type: Boolean, default: true })
  verificationEnabled: boolean;

  @Prop({ type: Number })
  purchasePrice: number;

  @Prop({ type: Number })
  salePrice: number;

  // ✅ METADATA CON TODA LA INFORMACIÓN ADICIONAL
  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  // ✅ USUARIO QUE VERIFICÓ
  @Prop({ type: String })
  verifiedBy: string;

  @Prop({ type: String })
  verifiedByName: string;

  @Prop({ type: Date, default: Date.now })
  verifiedAt: Date;
}

export const DeviceVerificationSchema = SchemaFactory.createForClass(DeviceVerification);

// Índices
DeviceVerificationSchema.index({ batchId: 1, partName: 1 });
DeviceVerificationSchema.index({ deviceId: 1 });
DeviceVerificationSchema.index({ partName: 1 });
DeviceVerificationSchema.index({ status: 1 });
DeviceVerificationSchema.index({ 'metadata.batchSku': 1 });
DeviceVerificationSchema.index({ 'metadata.orderId': 1 });