// src/notifications/order-observations.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderObservation, OrderObservationDocument } from './entities/order-observation.entity';
import { CreateOrderObservationDto, UpdateOrderObservationDto } from './dto/order-observation.dto';

@Injectable()
export class OrderObservationsService {
  private readonly logger = new Logger(OrderObservationsService.name);

  constructor(
    @InjectModel(OrderObservation.name)
    private observationModel: Model<OrderObservationDocument>,
  ) {}

  /**
   * Crear una nueva observación
   */
  async create(dto: CreateOrderObservationDto): Promise<OrderObservation> {
    const observation = new this.observationModel({
      ...dto,
      _id: new Types.UUID().toString(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    const saved = await observation.save();
    this.logger.log(`📝 Observación creada para orden ${dto.orderId} por ${dto.userName}`);
    return saved;
  }

  /**
   * Obtener observaciones por orderId
   */
  async findByOrderId(orderId: string, page: number = 1, limit: number = 20): Promise<{
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    observations: OrderObservation[];
  }> {
    const skip = (page - 1) * limit;
    
    const [observations, total] = await Promise.all([
      this.observationModel
        .find({ orderId, isActive: true })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.observationModel.countDocuments({ orderId, isActive: true }),
    ]);
    
    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      observations,
    };
  }

  /**
   * Obtener observaciones por usuario
   */
  async findByUserId(userId: string, page: number = 1, limit: number = 20): Promise<{
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    observations: OrderObservation[];
  }> {
    const skip = (page - 1) * limit;
    
    const [observations, total] = await Promise.all([
      this.observationModel
        .find({ userId, isActive: true })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.observationModel.countDocuments({ userId, isActive: true }),
    ]);
    
    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      observations,
    };
  }

  /**
   * Actualizar una observación
   */
  async update(id: string, dto: UpdateOrderObservationDto): Promise<OrderObservation | null> {
    const updated = await this.observationModel.findOneAndUpdate(
      { _id: id, isActive: true },
      { 
        observation: dto.observation,
        updatedAt: new Date() 
      },
      { new: true }
    );
    
    if (updated) {
      this.logger.log(`📝 Observación ${id} actualizada`);
    }
    
    return updated;
  }

  /**
   * Eliminar una observación (soft delete)
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.observationModel.updateOne(
      { _id: id },
      { isActive: false, updatedAt: new Date() }
    );
    
    if (result.modifiedCount > 0) {
      this.logger.log(`🗑️ Observación ${id} eliminada`);
      return true;
    }
    return false;
  }

  /**
   * Eliminar todas las observaciones de una orden
   */
  async deleteByOrderId(orderId: string): Promise<number> {
    const result = await this.observationModel.updateMany(
      { orderId, isActive: true },
      { isActive: false, updatedAt: new Date() }
    );
    
    this.logger.log(`🗑️ ${result.modifiedCount} observaciones eliminadas para orden ${orderId}`);
    return result.modifiedCount || 0;
  }
}