// microservicio-inventario/src/integrations/helpers/sku-generator.helper.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Counters } from '../models/counters.model';

@Injectable()
export class SkuGeneratorHelper {
  constructor(
    @InjectModel(Counters.name, 'atlas') 
    private countersModel: Model<Counters>,
  ) {}

  /**
   * Genera SKU con formato: {COMPONENTE(3 letras)}-{MARCA(3 letras)}-{COLOR(3 letras)}-INF{secuencia}
   * Ejemplo: REP-SAM-NIL-INF00000000000070
   */
  async generateSku(
    componentName: string,
    brand: string,
    color: string
  ): Promise<string> {
    const componentCode = this.getThreeLetters(componentName) || 'PRO';
    const brandCode = this.getThreeLetters(brand) || 'GEN';
    const colorCode = this.getThreeLetters(color) || 'SIN';
    
    // Obtener secuencia del contador
    const counter = await this.countersModel.findByIdAndUpdate(
      'sku_sequence',
      { $inc: { sequence_value: 1 } },
      { new: true, upsert: true }
    );
    
    const sequence = String(counter.sequence_value).padStart(14, '0');
    
    return `${componentCode}-${brandCode}-${colorCode}-INF${sequence}`;
  }

  /**
   * Obtiene las primeras 3 letras de un string
   */
  private getThreeLetters(value: string): string {
    if (!value) return 'XXX';
    
    const cleaned = value
      .toUpperCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z]/g, '');
    
    if (cleaned.length >= 3) {
      return cleaned.substring(0, 3);
    } else {
      return cleaned.padEnd(3, 'X');
    }
  }
}