// microservicio-inventario/src/categories/categories.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    // ✅ Agregar 'default' para usar la conexión correcta
    @InjectModel(Category.name, 'default') private categoryModel: Model<CategoryDocument>,
  ) {}

  async create(data: any): Promise<CategoryDocument> {
    const category = new this.categoryModel(data);
    return await category.save();
  }

  async findAll(filters: any = {}): Promise<CategoryDocument[]> {
    const query: any = { isDeleted: false };
    if (filters.name) {
      query.name = { $regex: filters.name, $options: 'i' };
    }
    return await this.categoryModel.find(query).sort({ name: 1 }).exec();
  }

  async findOne(id: string): Promise<CategoryDocument> {
    const category = await this.categoryModel.findOne({ _id: id, isDeleted: false });
    if (!category) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }
    return category;
  }

  async update(id: string, data: any): Promise<CategoryDocument> {
    const category = await this.findOne(id);
    Object.assign(category, data);
    category.updatedAt = new Date();
    return await category.save();
  }

  async delete(id: string): Promise<void> {
    const category = await this.findOne(id);
    category.isDeleted = true;
    category.deletedAt = new Date();
    await category.save();
  }
}