// src/notifications/call-counter.service.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CallCounter, CallCounterDocument } from './entities/call-history.entity';

@Injectable()
export class CallCounterService {
  private readonly MAX_CALLS = 10;

  constructor(
    @InjectModel(CallCounter.name)
    private callCounterModel: Model<CallCounterDocument>,
  ) {}

  /**
   * 📞 Incrementar el contador de llamadas de una orden
   */
  async incrementCall(
    orderId: string,
    orderNumber: number,
    companyId: string,
    userId: string
  ): Promise<CallCounter> {
    // Buscar el contador
    let counter = await this.callCounterModel.findOne({ orderId, companyId });

    // Si no existe, crearlo
    if (!counter) {
      counter = new this.callCounterModel({
        _id: new Types.UUID().toString(),
        orderId,
        orderNumber,
        companyId,
        count: 0,
        lastCalledAt: null,
        lastCalledBy: null
      });
    }

    // Verificar límite máximo
    if (counter.count >= this.MAX_CALLS) {
      throw new Error(`La orden ${orderNumber} ya tiene el máximo de ${this.MAX_CALLS} llamadas`);
    }

    // Incrementar contador
    counter.count += 1;
    counter.lastCalledAt = new Date();
    counter.lastCalledBy = userId;
    counter.updatedAt = new Date();

    await counter.save();

    console.log(`📞 [CallCounter] Orden #${orderNumber}: ${counter.count}/${this.MAX_CALLS} llamadas`);

    return counter;
  }

  /**
   * 📊 Obtener el contador de llamadas de una orden
   */
  async getCallCounter(orderId: string, companyId: string): Promise<{
    count: number;
    maxCalls: number;
    remaining: number;
    canCall: boolean;
    lastCalledAt: Date | null;
    lastCalledBy: string | null;
  }> {
    const counter = await this.callCounterModel.findOne({ orderId, companyId }).lean().exec();

    if (!counter) {
      // Si no existe, retornar valores por defecto
      return {
        count: 0,
        maxCalls: this.MAX_CALLS,
        remaining: this.MAX_CALLS,
        canCall: true,
        lastCalledAt: null,
        lastCalledBy: null
      };
    }

    return {
      count: counter.count,
      maxCalls: this.MAX_CALLS,
      remaining: Math.max(0, this.MAX_CALLS - counter.count),
      canCall: counter.count < this.MAX_CALLS,
      lastCalledAt: counter.lastCalledAt || null,
      lastCalledBy: counter.lastCalledBy || null
    };
  }
}