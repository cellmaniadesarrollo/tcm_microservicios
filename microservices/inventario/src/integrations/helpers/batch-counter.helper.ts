// microservicio-inventario/src/integrations/helpers/batch-counter.helper.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CounterBatch } from '../models/counter-batch.model';

@Injectable()
export class BatchCounterHelper {
  constructor(
    @InjectModel(CounterBatch.name, 'atlas') 
    private counterBatchModel: Model<CounterBatch>,
  ) {}

  // ✅ ACEPTA ObjectId O string
  async getNextBatchNumber(itemId: Types.ObjectId | string): Promise<number> {
    // Convertir a string si es ObjectId
    const itemIdStr = itemId instanceof Types.ObjectId ? itemId.toString() : itemId;
    const counterId = `batch_${itemIdStr}`;
    
    const counter = await this.counterBatchModel.findByIdAndUpdate(
      counterId,
      { 
        $inc: { seq: 1 },
        $set: { item: itemIdStr }
      },
      { new: true, upsert: true }
    );
    
    return counter.seq;
  }
}