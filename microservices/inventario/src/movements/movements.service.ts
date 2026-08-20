// microservicio-inventario/src/movements/movements.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InventoryMovement, InventoryMovementDocument } from './entities/inventory-movement.entity';

@Injectable()
export class MovementsService {
  constructor(
    // ✅ Agregar 'default' para usar la conexión correcta
    @InjectModel(InventoryMovement.name, 'default') 
    private movementModel: Model<InventoryMovementDocument>,
  ) {}

  async create(data: any): Promise<InventoryMovementDocument> {
    const movement = new this.movementModel(data);
    return await movement.save();
  }

  async findByProduct(productId: string): Promise<InventoryMovementDocument[]> {
    return await this.movementModel
      .find({ productId, isDeleted: false })
      .sort({ performedAt: -1 })
      .exec();
  }

  async findByOrder(orderId: string): Promise<InventoryMovementDocument[]> {
    return await this.movementModel
      .find({ relatedOrderId: orderId, isDeleted: false })
      .sort({ performedAt: -1 })
      .exec();
  }

  async findAll(filters: any = {}): Promise<InventoryMovementDocument[]> {
    const query: any = { isDeleted: false };
    
    if (filters.productId) {
      query.productId = filters.productId;
    }
    
    if (filters.movementType) {
      query.movementType = filters.movementType;
    }

    return await this.movementModel
      .find(query)
      .sort({ performedAt: -1 })
      .limit(filters.limit || 100)
      .skip(filters.offset || 0)
      .exec();
  }

  async findOne(id: string): Promise<InventoryMovementDocument> {
    const movement = await this.movementModel.findOne({ _id: id, isDeleted: false });
    if (!movement) {
      throw new NotFoundException(`Movimiento con ID ${id} no encontrado`);
    }
    return movement;
  }

  async getStatsByProduct(productId: string): Promise<any> {
    const stats = await this.movementModel.aggregate([
      { $match: { productId, isDeleted: false } },
      { 
        $group: {
          _id: '$movementType',
          total: { $sum: '$quantity' },
          count: { $sum: 1 }
        }
      }
    ]);

    return stats;
  }
}