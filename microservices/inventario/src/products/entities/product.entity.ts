// microservicio-inventario/src/products/entities/product.entity.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

export enum ProductCondition {
  NUEVO = 'NUEVO',
  OPEN_BOX = 'OPEN_BOX',
  RECONDICIONADO = 'RECONDICIONADO',
  USADO = 'USADO',
  DEMO = 'DEMO',
  REPARADO = 'REPARADO',
  REFURBISHED = 'REFURBISHED',
}

export enum ProductStatus {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
  EN_REPARACION = 'EN_REPARACION',
  RESERVADO = 'RESERVADO',
  VENDIDO = 'VENDIDO',
}

export enum ProductQuality {
  A = 'A',
  B = 'B',
  C = 'C',
  RECONDICIONADO = 'RECONDICIONADO',
}

@Schema({ timestamps: true, collection: 'products' })
export class Product {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id?: string;

  @Prop({ type: String, required: true, unique: true, index: true, uppercase: true })
  code!: string;

  // ✅ AGREGAR SKU
  @Prop({ 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
    uppercase: true,
    default: () => {
      const random = Math.floor(Math.random() * 10000000000000).toString().padStart(14, '0');
      return `INS-UNI-TRA-INF${random}`;
    }
  })
  sku!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true })
  brand!: string;

  @Prop({ type: String, required: true })
  model!: string;

  @Prop({ type: String, required: true })
  type!: string;

  @Prop({ type: String, required: true })
  color!: string;

  @Prop({ type: String, enum: ProductQuality, default: ProductQuality.B })
  quality!: ProductQuality;

  @Prop({ type: String, enum: ProductCondition, default: ProductCondition.USADO })
  condition!: ProductCondition;

  @Prop({ type: String, enum: ProductStatus, default: ProductStatus.ACTIVO })
  status!: ProductStatus;

  @Prop({ type: String, default: null })
  observations?: string;

  @Prop({ type: Number, default: null })
  deviceId?: number;

  @Prop({ type: String, default: null })
  categoryId?: string;

  @Prop({ type: String, default: null })
  subcategoryId?: string;

  @Prop({ type: Number, default: null })
  purchasePrice?: number;

  @Prop({ type: Number, default: null })
  salePrice?: number;

  @Prop({ type: Number, default: 0 })
  stockQuantity!: number;

  @Prop({ type: Number, default: 0 })
  minStockThreshold!: number;

  @Prop({ type: String, default: null })
  location?: string;

  @Prop({ type: Array, default: [] })
  inventoryHistory!: any[];

  @Prop({ type: Array, default: [] })
  statusHistory!: any[];

  @Prop({ type: String, default: null })
  createdById?: string;

  @Prop({ type: String, default: null })
  createdByName?: string;

  @Prop({ type: String, default: null })
  lastUpdatedById?: string;

  @Prop({ type: String, default: null })
  lastUpdatedByName?: string;

  @Prop({ type: Boolean, default: false })
  isDeleted!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date;

  @Prop({ type: String, default: null })
  deletedById?: string;

  @Prop({ type: String, default: null })
  deletedByName?: string;

  @Prop({ type: Object, default: null })
  metadata?: Record<string, any>;

  @Prop({ type: String, default: null })
  imageUrl?: string;

  @Prop({ type: Array, default: [] })
  images?: string[];

  @Prop({ type: Boolean, default: false })
  isLowStock!: boolean;

  @Prop({ type: Date, default: null })
  lowStockAlertSentAt?: Date;

  @Prop({ type: Number, default: null })
  warrantyDays?: number;

  @Prop({ type: Date, default: null })
  warrantyExpirationDate?: Date;

  @Prop({ type: String, default: null })
  supplierId?: string;

  @Prop({ type: String, default: null })
  supplierName?: string;

  @Prop({ type: Date, default: null })
  purchaseDate?: Date;

  @Prop({ type: String, default: null })
  invoiceNumber?: string;

  @Prop({ type: String, default: null })
  lastOrderId?: string;

  @Prop({ type: Number, default: null })
  lastOrderNumber?: number;

  @Prop({ type: Date, default: null })
  lastOrderDate?: Date;

  @Prop({ type: Date, default: Date.now })
  createdAt!: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt!: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Índices
ProductSchema.index({ name: 'text', brand: 'text', model: 'text', code: 'text' });
ProductSchema.index({ brand: 1, model: 1, color: 1 });
ProductSchema.index({ stockQuantity: 1 });
ProductSchema.index({ status: 1, isDeleted: 1 });
ProductSchema.index({ code: 1 });
ProductSchema.index({ sku: 1 }); // ✅ Índice para SKU
ProductSchema.index({ categoryId: 1 });
ProductSchema.index({ createdById: 1, createdAt: -1 });