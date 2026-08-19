// microservicio-inventario/src/integrations/helpers/batch-counter.helper.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CounterBatch } from '../models/counter-batch.model';

@Injectable()
export class BatchCounterHelper {
  private readonly logger = new Logger(BatchCounterHelper.name);

  constructor(
    @InjectModel(CounterBatch.name, 'atlas') 
    private counterBatchModel: Model<CounterBatch>,
  ) {
    this.logger.log('✅ BatchCounterHelper inicializado');
  }

  /**
   * Obtener el siguiente número de batch para un item
   * - Si no existe → seq = 1
   * - Si existe → seq = seq + 1
   * @param itemId - ID del item (puede ser ObjectId o string)
   * @returns Número de batch secuencial
   */
  async getNextBatchNumber(itemId: Types.ObjectId | string): Promise<number> {
    try {
      // ✅ Convertir a string seguro
      const itemIdStr = itemId instanceof Types.ObjectId ? itemId.toString() : itemId;
      const counterId = `batch_${itemIdStr}`;
      
      this.logger.log(`📤 Generando batch number para item: ${itemIdStr}`);
      this.logger.log(`📤 Counter ID: ${counterId}`);

      // ✅ PRIMERO: Buscar el contador existente
      let existingCounter = await this.counterBatchModel.findOne({ _id: counterId }).exec();
      
      let nextSeq: number;

      if (!existingCounter) {
        // ✅ No existe → Crear con seq = 1
        this.logger.log(`📝 No existe contador, creando nuevo con seq: 1`);
        
        const newCounter = new this.counterBatchModel({
          _id: counterId,
          seq: 1,
          item: new Types.ObjectId(itemIdStr)
        });
        
        await newCounter.save();
        nextSeq = 1;
        
        this.logger.log(`✅ Contador creado: ${counterId} - seq: 1`);
        
        // Verificar que se guardó
        const verifyCounter = await this.counterBatchModel.findOne({ _id: counterId }).exec();
        this.logger.log(`✅ Verificación: ${verifyCounter ? 'Contador existe' : 'Contador NO existe'}`);
        if (verifyCounter) {
          this.logger.log(`✅ Verificación: seq = ${verifyCounter.seq}`);
        }
      } else {
        // ✅ Existe → Incrementar seq
        this.logger.log(`📝 Contador existe con seq: ${existingCounter.seq}`);
        nextSeq = existingCounter.seq + 1;
        this.logger.log(`📝 Nuevo seq: ${nextSeq}`);
        
        // ✅ Actualizar el contador usando findOneAndUpdate con new: true
        const updatedCounter = await this.counterBatchModel.findOneAndUpdate(
          { _id: counterId },
          { $inc: { seq: 1 } },
          { new: true }
        ).exec();
        
        if (updatedCounter) {
          this.logger.log(`✅ Contador actualizado: seq = ${updatedCounter.seq}`);
        } else {
          this.logger.warn(`⚠️ No se pudo actualizar el contador, intentando de nuevo...`);
          // ✅ Intento de recuperación: si falla, crear uno nuevo
          const newCounter = new this.counterBatchModel({
            _id: counterId,
            seq: 1,
            item: new Types.ObjectId(itemIdStr)
          });
          await newCounter.save();
          nextSeq = 1;
          this.logger.log(`✅ Contador recreado con seq: 1`);
        }
      }

      this.logger.log(`✅ Batch number final: ${nextSeq} para item: ${itemIdStr}`);
      return nextSeq;
      
    } catch (error: any) {
      this.logger.error(`❌ Error generando batch number: ${error.message}`);
      this.logger.error(`❌ Stack: ${error.stack}`);
      throw error;
    }
  }

  /**
   * Obtener el número de batch actual (sin incrementar)
   */
  async getCurrentBatchNumber(itemId: Types.ObjectId | string): Promise<number> {
    try {
      const itemIdStr = itemId instanceof Types.ObjectId ? itemId.toString() : itemId;
      const counterId = `batch_${itemIdStr}`;
      
      const counter = await this.counterBatchModel.findOne({ _id: counterId }).exec();
      const currentSeq = counter?.seq || 0;
      
      this.logger.log(`📊 Batch actual para item ${itemIdStr}: ${currentSeq}`);
      return currentSeq;
      
    } catch (error: any) {
      this.logger.error(`❌ Error obteniendo batch number: ${error.message}`);
      return 0;
    }
  }

  /**
   * Reiniciar el contador de batch para un item (opcional)
   * Útil para pruebas o reinicios manuales
   */
  async resetBatchCounter(itemId: Types.ObjectId | string): Promise<void> {
    try {
      const itemIdStr = itemId instanceof Types.ObjectId ? itemId.toString() : itemId;
      const counterId = `batch_${itemIdStr}`;
      
      // ✅ Primero obtener el contador antes de eliminarlo
      const counter = await this.counterBatchModel.findOne({ _id: counterId }).exec();
      
      if (counter) {
        const seqValue = counter.seq; // ✅ Guardamos el valor antes de eliminar
        await this.counterBatchModel.findOneAndDelete({ _id: counterId }).exec();
        this.logger.log(`🔄 Contador eliminado para item: ${itemIdStr} (era seq: ${seqValue})`);
      } else {
        this.logger.log(`ℹ️ No existía contador para item: ${itemIdStr}`);
      }
      
    } catch (error: any) {
      this.logger.error(`❌ Error reiniciando contador: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtener todos los contadores (para debugging)
   */
  async getAllCounters(): Promise<CounterBatch[]> {
    try {
      return await this.counterBatchModel.find().sort({ createdAt: -1 }).exec();
    } catch (error: any) {
      this.logger.error(`❌ Error obteniendo contadores: ${error.message}`);
      return [];
    }
  }

  /**
   * Obtener contador por item ID (para debugging)
   */
  async getCounterByItemId(itemId: Types.ObjectId | string): Promise<CounterBatch | null> {
    try {
      const itemIdStr = itemId instanceof Types.ObjectId ? itemId.toString() : itemId;
      const counterId = `batch_${itemIdStr}`;
      return await this.counterBatchModel.findOne({ _id: counterId }).exec();
    } catch (error: any) {
      this.logger.error(`❌ Error obteniendo contador: ${error.message}`);
      return null;
    }
  }

  /**
   * Forzar creación de contador con un seq específico (para pruebas)
   */
  async forceSetCounter(itemId: Types.ObjectId | string, seq: number): Promise<void> {
    try {
      const itemIdStr = itemId instanceof Types.ObjectId ? itemId.toString() : itemId;
      const counterId = `batch_${itemIdStr}`;
      
      // ✅ Eliminar si existe
      await this.counterBatchModel.findOneAndDelete({ _id: counterId }).exec();
      
      // ✅ Crear con el seq deseado
      const newCounter = new this.counterBatchModel({
        _id: counterId,
        seq: seq,
        item: new Types.ObjectId(itemIdStr)
      });
      
      await newCounter.save();
      this.logger.log(`✅ Contador forzado: ${counterId} - seq: ${seq}`);
      
    } catch (error: any) {
      this.logger.error(`❌ Error forzando contador: ${error.message}`);
      throw error;
    }
  }

  /**
   * Diagnóstico completo de un contador
   */
  async diagnoseCounter(itemId: Types.ObjectId | string): Promise<any> {
    try {
      const itemIdStr = itemId instanceof Types.ObjectId ? itemId.toString() : itemId;
      const counterId = `batch_${itemIdStr}`;
      
      this.logger.log(`🔍 Diagnosticando contador para: ${itemIdStr}`);
      
      // 1. Buscar el contador
      const counter = await this.counterBatchModel.findOne({ _id: counterId }).exec();
      
      // 2. Buscar todos los documentos en counterbatches
      const allCounters = await this.counterBatchModel.find().exec();
      
      this.logger.log(`📊 Contador: ${counter ? JSON.stringify(counter) : 'NO ENCONTRADO'}`);
      this.logger.log(`📊 Total de contadores en la colección: ${allCounters.length}`);
      
      return {
        counter,
        allCounters: allCounters.map(c => ({ id: c._id, seq: c.seq, item: c.item })),
        totalCounters: allCounters.length
      };
      
    } catch (error: any) {
      this.logger.error(`❌ Error diagnosticando: ${error.message}`);
      throw error;
    }
  }
}