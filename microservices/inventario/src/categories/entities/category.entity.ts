import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ timestamps: true, collection: 'categories' })
export class Category {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id?: string;

  @Prop({ type: String, required: true, unique: true })
  name!: string;

  @Prop({ type: String, default: null })
  description?: string;

  @Prop({ type: String, default: null })
  parentId?: string;

  @Prop({ type: String, default: '#000000' })
  color!: string;

  @Prop({ type: String, default: null })
  icon?: string;

  @Prop({ type: Number, default: 0 })
  order!: number;

  @Prop({ type: Boolean, default: false })
  isDeleted!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date;

  @Prop({ type: Date, default: Date.now })
  createdAt!: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt!: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);