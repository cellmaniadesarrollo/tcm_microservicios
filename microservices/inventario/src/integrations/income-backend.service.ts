// microservicio-inventario/src/integrations/income-backend.service.ts

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { ProductsService } from '../products/products.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class IncomeBackendService {
  private readonly logger = new Logger(IncomeBackendService.name);

  constructor(
    @InjectModel('Income') private incomeModel: Model<any>,
    @Inject(forwardRef(() => ProductsService)) private productsService: ProductsService,
    private configService: ConfigService,
  ) {
    this.logger.log('✅ IncomeBackendService inicializado');
  }

  // ============================================
  // ✅ SYNC PRODUCT - VERSIÓN COMPLETA
  // ============================================

  async syncProduct(product: any, orderData: any, component: any): Promise<any> {
    try {
      this.logger.log(`📤 Sincronizando producto: ${product?.name || 'N/A'}`);

      // 1️⃣ Generar UUID para el ingreso
      const uuid = uuidv4();

      // 2️⃣ Obtener IDs necesarios
      const statusId = new Types.ObjectId('65bba1f9089b1af39563eaf5'); // PENDIENTE

      // 3️⃣ Construir payload completo
      const payload = {
        // Campos básicos
        unit_price: component?.purchasePrice?.toString() || '0',
        unit_sales_price: component?.salePrice?.toString() || '0',
        observations: component?.observations || component?.description || `Ingreso desde orden ${orderData?.orderNumber || 'N/A'}`,
        quantity: component?.quantity || 1,
        date_income: new Date(),
        
        // IDs
        id_document_number: orderData?.id_document_number || new Types.ObjectId(),
        id_item: product?._id || new Types.ObjectId(),
        id_coduuid: new Types.ObjectId(),
        id_status: statusId,
        
        // Usuario
        user_create: orderData?.createdByName || orderData?.createdById || 'ordenes',
        
        // Batch snapshot
        batch_snapshot: {
          batchNumber: orderData?.batchNumber || 1,
          identifiers: orderData?.imeis || []
        },
        
        // ✅ Inventory snapshot - USAR product.sku, NO product.code
        inventory_snapshot: {
          inventory_id: orderData?.inventory_id || new Types.ObjectId('6659dafad31672b6ed063b49'),
          inventory_name: orderData?.inventory_name || 'INVENTORYFLOW',
          sku: product?.sku || '', // ✅ CORREGIDO: usar sku del producto
          upc: product?.upc || '',
          name_item: product?.name || '',
          name_model: product?.model || '',
          name_color: product?.color || '',
          name_quality: product?.quality || 'ORIGINAL'
        }
      };

      this.logger.debug(`[syncProduct] Payload: ${JSON.stringify(payload, null, 2)}`);

      // 4️⃣ Guardar en incomes
      const result = await this.saveIncome(payload);
      
      this.logger.log(`✅ Producto ${product?.name || 'N/A'} sincronizado en incomes`);
      
      // 5️⃣ Retornar datos completos
      return {
        success: true,
        incomeId: result.data._id,
        sku: payload.inventory_snapshot.sku,
        batchNumber: payload.batch_snapshot.batchNumber,
        unitPrice: payload.unit_price,
        quantity: payload.quantity
      };

    } catch (error: any) {
      this.logger.error(`❌ Error sincronizando producto: ${error.message}`);
      this.logger.error(error.stack);
      throw error;
    }
  }

  // ============================================
  // ✅ GUARDAR INCOME
  // ============================================

  async saveIncome(payload: any): Promise<any> {
    try {
      this.logger.log(`📤 Guardando income en MongoDB...`);
      this.logger.debug(`Payload: ${JSON.stringify(payload, null, 2)}`);

      const incomeData = this.buildIncomeData(payload);
      const newIncome = new this.incomeModel(incomeData);
      const saved = await newIncome.save();

      this.logger.log(`✅ Income guardado correctamente: ${saved._id}`);
      return {
        success: true,
        data: saved,
        message: 'Income guardado exitosamente'
      };
    } catch (error: any) {
      this.logger.error(`❌ Error guardando income: ${error.message}`);
      throw {
        statusCode: 500,
        message: error.message || 'Error al guardar income'
      };
    }
  }

  // ============================================
  // 🔧 GENERAR SKU
  // ============================================

  // private generateSku(product: any): string {
  //   const prefix = 'INS-UNI-TRA-INF';
  //   const random = Math.floor(Math.random() * 10000000000000).toString().padStart(14, '0');
  //   return `${prefix}${random}`;
  // }

  // ============================================
  // 🔧 MÉTODOS PRIVADOS
  // ============================================

  private buildIncomeData(payload: any): any {
    const defaultId = new Types.ObjectId();

    return {
      unit_price: this.getField(payload, ['unit_price', 'preciounit', 'unitPrice'], '0'),
      unit_sales_price: this.getField(payload, ['unit_sales_price', 'precioventa', 'unitSalesPrice'], '0'),
      observations: this.getField(payload, ['observations', 'observaciones', 'descripcion', 'description'], ''),
      quantity: Number(this.getField(payload, ['quantity', 'cantidad', 'qty'], 1)),
      date_income: this.getField(payload, ['date_income', 'fecha', 'date', 'createdAt'], new Date()),
      id_document_number: this.toObjectId(
        this.getField(payload, ['id_document_number', 'numero_documento', 'documentNumber']),
        defaultId
      ),
      id_item: this.toObjectId(
        this.getField(payload, ['id_item', 'productId', 'itemId']),
        defaultId
      ),
      id_coduuid: this.toObjectId(
        this.getField(payload, ['id_coduuid', 'coduuid', 'uuid']),
        defaultId
      ),
      id_status: this.toObjectId(
        this.getField(payload, ['id_status', 'statusId', 'estadoId']),
        new Types.ObjectId('65bba1f9089b1af39563eaf5')
      ),
      user_create: this.getField(payload, ['user_create', 'usuario', 'user'], 'ordenes'),
      batch_snapshot: this.buildBatchSnapshot(payload),
      inventory_snapshot: this.buildInventorySnapshot(payload),
    };
  }

  private buildBatchSnapshot(payload: any): any {
    return {
      batchNumber: Number(this.getField(payload, ['batchNumber', 'batch', 'lote'], 1)),
      identifiers: this.getField(payload, ['identifiers', 'identificadores', 'ids'], [])
    };
  }

  private buildInventorySnapshot(payload: any): any {
    const defaultId = new Types.ObjectId();

    return {
      inventory_id: this.toObjectId(
        this.getField(payload, ['inventory_id', 'inventoryId', 'bodegaId']),
        new Types.ObjectId('6659dafad31672b6ed063b49')
      ),
      inventory_name: this.getField(payload, ['inventory_name', 'inventoryName', 'bodega'], 'INVENTORYFLOW'),
      sku: this.getField(payload, ['sku', 'codigo', 'code'], ''),
      upc: this.getField(payload, ['upc', 'codigoBarra', 'barcode'], ''),
      name_item: this.getField(payload, ['name_item', 'nameItem', 'nombre', 'productName'], ''),
      name_model: this.getField(payload, ['name_model', 'nameModel', 'modelo', 'model'], ''),
      name_color: this.getField(payload, ['name_color', 'nameColor', 'color'], ''),
      name_quality: this.getField(payload, ['name_quality', 'nameQuality', 'calidad', 'quality'], 'ORIGINAL')
    };
  }

  private getField(payload: any, keys: string[], defaultValue: any = null): any {
    for (const key of keys) {
      if (payload && payload[key] !== undefined && payload[key] !== null) {
        return payload[key];
      }
    }
    return defaultValue;
  }

  private toObjectId(value: any, defaultValue: any = null): any {
    if (!value) return defaultValue || new Types.ObjectId();
    try {
      if (value instanceof Types.ObjectId) return value;
      if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
        return new Types.ObjectId(value);
      }
      return defaultValue || new Types.ObjectId();
    } catch (error) {
      this.logger.warn(`⚠️ Error convirtiendo a ObjectId: ${value}`);
      return defaultValue || new Types.ObjectId();
    }
  }

  // ============================================
  // ⚠️ MÉTODOS DE COMPATIBILIDAD
  // ============================================

  async saveInventoryFromOrder(payload: any): Promise<any> {
    this.logger.log(`📤 saveInventoryFromOrder llamado - OrderId: ${payload.orderId || 'N/A'}`);
    return this.productsService.createFromOrder(payload);
  }
}