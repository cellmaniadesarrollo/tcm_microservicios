// microservicio-inventario/src/integrations/income-backend.service.ts

import { Injectable, Logger, Inject, forwardRef, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { ProductsService } from '../products/products.service';
import { v4 as uuidv4 } from 'uuid';

// Helpers
import { BatchCounterHelper } from './helpers/batch-counter.helper';
import { SkuGeneratorHelper } from './helpers/sku-generator.helper';

// Modelos
import { Income } from './models/income.model';
import { Batch } from './models/batch.model';
import { BranchBatchStock } from './models/branch-batch-stock.model';
import { InventoryFlow } from './models/inventory-flow.model';
import { CounterBatch } from './models/counter-batch.model';
import { Counters } from './models/counters.model';
import { DocumentNumberIncome } from './models/document-number-income.model';
import { InventoryFlowNameItem } from './models/inventory-flow-name-item.model';
import { Color } from './models/color.model';
import { Brand } from './models/brand.model';
import { TypeInventoryFlow } from './models/type-inventory-flow.model';

@Injectable()
export class IncomeBackendService {
  private readonly logger = new Logger(IncomeBackendService.name);

  constructor(
    @InjectModel(Income.name, 'atlas') private incomeModel: Model<Income>,
    @InjectModel(Batch.name, 'atlas') private batchModel: Model<Batch>,
    @InjectModel(BranchBatchStock.name, 'atlas') private branchBatchStockModel: Model<BranchBatchStock>,
    @InjectModel(InventoryFlow.name, 'atlas') private inventoryFlowModel: Model<InventoryFlow>,
    @InjectModel(CounterBatch.name, 'atlas') private counterBatchModel: Model<CounterBatch>,
    @InjectModel(Counters.name, 'atlas') private countersModel: Model<Counters>,
    @InjectModel(DocumentNumberIncome.name, 'atlas') private documentNumberIncomeModel: Model<DocumentNumberIncome>,
    @InjectModel(InventoryFlowNameItem.name, 'atlas') private inventoryFlowNameItemModel: Model<InventoryFlowNameItem>,
    @InjectModel(Color.name, 'atlas') private colorModel: Model<Color>,
    @InjectModel(Brand.name, 'atlas') private brandModel: Model<Brand>,
    @InjectModel(TypeInventoryFlow.name, 'atlas') private typeInventoryFlowModel: Model<TypeInventoryFlow>,
    @Inject(forwardRef(() => ProductsService)) private productsService: ProductsService,
    private configService: ConfigService,
    private batchCounterHelper: BatchCounterHelper,
    private skuGeneratorHelper: SkuGeneratorHelper,
  ) {
    this.logger.log('✅ IncomeBackendService inicializado');
  }

  // ============================================
  // ✅ HELPER - Validar ObjectId
  // ============================================

  private isValidObjectId(value: any): boolean {
    if (!value) return false;
    if (value instanceof Types.ObjectId) return true;
    if (typeof value === 'string') return Types.ObjectId.isValid(value);
    return false;
  }

  private toObjectIdSafe(value: any, defaultValue: any = null): Types.ObjectId {
    if (this.isValidObjectId(value)) {
      return new Types.ObjectId(value);
    }
    return defaultValue || new Types.ObjectId();
  }

  // ============================================
  // ✅ HELPER - Obtener nombres por ID
  // ============================================

  private async getTypeNameById(typeId: string): Promise<string> {
    try {
      const type = await this.typeInventoryFlowModel.findById(typeId).lean();
      return type?.type_inventoryflow || 'PRODUCTO';
    } catch {
      return 'PRODUCTO';
    }
  }

  private async getBrandNameById(brandId: string): Promise<string> {
    try {
      const brand = await this.brandModel.findById(brandId).lean();
      return brand?.name_brands || 'GENERICO';
    } catch {
      return 'GENERICO';
    }
  }

  private async getColorNameById(colorId: string): Promise<string> {
    try {
      const color = await this.colorModel.findById(colorId).lean();
      return color?.color_name || 'SINCOLOR';
    } catch {
      return 'SINCOLOR';
    }
  }

  // ============================================
  // ✅ HELPER - Crear o obtener InventoryFlowNameItem
  // ============================================

  private async getOrCreateInventoryFlowNameItem(name: string): Promise<Types.ObjectId> {
    try {
      const upperName = name.toUpperCase().trim();
      
      if (!upperName) {
        this.logger.warn('⚠️ Nombre vacío, usando ID por defecto');
        return new Types.ObjectId('67dc9bcc638dcb1e2f407278');
      }

      const existing = await this.inventoryFlowNameItemModel.findOne({
        name_nameitems: upperName
      }).lean();
      
      if (existing) {
        this.logger.log(`✅ InventoryFlowNameItem encontrado: ${existing.name_nameitems} (${existing._id})`);
        return existing._id;
      }
      
      this.logger.log(`📝 Creando nuevo InventoryFlowNameItem: ${upperName}`);
      const newNameItem = new this.inventoryFlowNameItemModel({
        name_nameitems: upperName
      });
      
      const saved = await newNameItem.save();
      this.logger.log(`✅ InventoryFlowNameItem creado: ${saved.name_nameitems} (${saved._id})`);
      return saved._id;

    } catch (error: any) {
      this.logger.error(`❌ Error creando InventoryFlowNameItem: ${error.message}`);
      return new Types.ObjectId('67dc9bcc638dcb1e2f407278');
    }
  }

  // ============================================
  // ✅ HELPER - Crear o obtener InventoryFlow
  // ============================================

  private async getOrCreateInventoryFlow(product: any, orderData: any): Promise<{ inventoryFlowId: Types.ObjectId; sku: string; upc: string }> {
    try {
      // 1️⃣ Buscar por deviceId
      if (orderData?.deviceId) {
        const deviceIdStr = String(orderData.deviceId);
        if (this.isValidObjectId(deviceIdStr)) {
          const flow = await this.inventoryFlowModel.findById(deviceIdStr).lean();
          if (flow) {
            const productName = product?.name?.toUpperCase().trim() || '';
            const flowName = flow.name_nameitems?.toUpperCase().trim() || '';
            
            // ✅ Verificar que el nombre coincida (sin marca porque el modelo no tiene name_brand)
            if (productName && flowName && productName !== flowName) {
              this.logger.warn(`⚠️ El InventoryFlow encontrado por deviceId (${flowName}) NO coincide con el producto (${productName})`);
              this.logger.warn(`⚠️ Se creará un nuevo InventoryFlow para: ${productName}`);
            } else {
              this.logger.log(`✅ InventoryFlow encontrado por deviceId: ${flow._id}, SKU: ${flow.sku}`);
              return { inventoryFlowId: flow._id, sku: flow.sku, upc: flow.upc || '' };
            }
          }
        }
      }
      
      // 2️⃣ Buscar por nombre exacto
      if (product?.name) {
        const productName = product.name.toUpperCase().trim();
        const flow = await this.inventoryFlowModel.findOne({ 
          name_nameitems: productName 
        }).lean();
        
        if (flow) {
          this.logger.log(`✅ InventoryFlow encontrado por nombre exacto: ${flow._id}, SKU: ${flow.sku}`);
          return { inventoryFlowId: flow._id, sku: flow.sku, upc: flow.upc || '' };
        }
      }
      
      // 3️⃣ Buscar por SKU
      if (product?.sku) {
        const flow = await this.inventoryFlowModel.findOne({ sku: product.sku }).lean();
        if (flow) {
          this.logger.log(`✅ InventoryFlow encontrado por SKU: ${flow._id}, SKU: ${flow.sku}`);
          return { inventoryFlowId: flow._id, sku: flow.sku, upc: flow.upc || '' };
        }
      }
      
      // 4️⃣ No existe - CREAR NUEVO INVENTORYFLOW
      const nameItemId = await this.getOrCreateInventoryFlowNameItem(product?.name || 'Producto');
      
      // ✅ GENERAR SKU Y UPC CON EL MISMO NÚMERO SECUENCIAL
      const { sku, upc } = await this.skuGeneratorHelper.generateSku(
        product?.name || 'PRODUCTO',
        product?.brand || orderData?.brand || 'GENERICO',
        product?.color || orderData?.color || 'SINCOLOR',
        'INVENTORYFLOW'
      );
      
      this.logger.log(`📝 Creando nuevo InventoryFlow para: ${product?.name || 'Producto'} con SKU: ${sku}, UPC: ${upc}`);
      
      const newFlow = new this.inventoryFlowModel({
        upc: upc,
        sku: sku,
        id_name_items: nameItemId,
        id_model: new Types.ObjectId('67f94785d875ff138dfcb14d'),
        id_color: new Types.ObjectId('65c7e7c5d419e2c1431e7a13'),
        id_quality: new Types.ObjectId('67ef4037d89e01cc7bd8bc50'),
        name_model: product?.model || orderData?.model || 'Dispositivo',
        name_color: product?.color || orderData?.color || 'No especificado',
        name_quality: product?.quality || 'ORIGINAL',
        name_nameitems: product?.name || 'Producto',
        item_price: '0.00',
        id_stateproduct_inventoryflow: new Types.ObjectId('656a0f5fa993eec6c53fdfc1'),
        id_state: new Types.ObjectId('655f6ec995aabcb0e63a542d'),
        id_type: new Types.ObjectId('656a0f31a993eec6c53fdfb1'),
        id_type_inventory: new Types.ObjectId('6659dafad31672b6ed063b49'),
        ...(orderData?.deviceId && /^\d+$/.test(String(orderData.deviceId)) 
          ? { device_id_numero: parseInt(String(orderData.deviceId)) } 
          : {}),
      });

      const saved = await newFlow.save();
      this.logger.log(`✅ InventoryFlow creado: ${saved._id} - ${saved.name_nameitems} - SKU: ${saved.sku} - UPC: ${saved.upc}`);
      return { inventoryFlowId: saved._id, sku: saved.sku, upc: saved.upc };

    } catch (error: any) {
      this.logger.error(`❌ Error creando InventoryFlow: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // ✅ SYNC PRODUCT - CORREGIDO
  // ============================================

  async syncProduct(product: any, orderData: any, component: any): Promise<any> {
    try {
      this.logger.log(`📤 Sincronizando producto: ${product?.name || 'N/A'}`);
      this.logger.log(`📦 SKU actual del Product: ${product?.sku || 'NO SKU'}`);

      // ✅ Obtener InventoryFlow (y su SKU y UPC)
      const { inventoryFlowId, sku: inventorySku, upc: inventoryUpc } = await this.getOrCreateInventoryFlow(product, orderData);

      if (!inventoryFlowId) {
        throw new Error(`No se pudo obtener o crear InventoryFlow para: ${product?.name}`);
      }

      // ✅ ACTUALIZAR EL SKU DEL PRODUCT CON EL DEL INVENTORYFLOW
      if (product?.sku !== inventorySku) {
        this.logger.log(`🔄 Actualizando SKU del Product: ${product?.sku} -> ${inventorySku}`);
        await this.productsService.updateSku(product._id, inventorySku);
        product.sku = inventorySku;
        this.logger.log(`✅ SKU del Product actualizado a: ${inventorySku}`);
      }

      // ✅ ACTUALIZAR EL UPC DEL PRODUCT CON EL DEL INVENTORYFLOW
      if (product?.upc !== inventoryUpc) {
        this.logger.log(`🔄 Actualizando UPC del Product: ${product?.upc} -> ${inventoryUpc}`);
        await this.productsService.updateUpc(product._id, inventoryUpc);
        product.upc = inventoryUpc;
        this.logger.log(`✅ UPC del Product actualizado a: ${inventoryUpc}`);
      }

      // ✅ Validar customerId
      let supplierId: Types.ObjectId;
      if (orderData?.customerId && this.isValidObjectId(orderData.customerId)) {
        supplierId = this.toObjectIdSafe(orderData.customerId);
      } else {
        supplierId = new Types.ObjectId('64eccd1c36843268d5d2b6fc');
        this.logger.warn(`⚠️ customerId inválido, usando ID por defecto: ${supplierId}`);
      }

      // ✅ Construir payload con el SKU y UPC correctos
      const payload = {
        unit_price: component?.purchasePrice?.toString() || '0',
        unit_sales_price: component?.salePrice?.toString() || '0',
        observations: component?.observations || component?.description || `Ingreso desde orden ${orderData?.orderNumber || 'N/A'}`,
        quantity: component?.quantity || 1,
        date_income: new Date(),
        id_item: inventoryFlowId,
        id_coduuid: new Types.ObjectId(),
        id_status: new Types.ObjectId('65bba1f9089b1af39563eaf5'),
        user_create: orderData?.createdByName || orderData?.createdById || 'ordenes',
        inventory_id: orderData?.inventory_id || new Types.ObjectId('67b3bc26b850b543c94ca47d'),
        inventory_name: orderData?.inventory_name || 'INVENTORYFLOW',
        sku: inventorySku,
        upc: inventoryUpc,
        name_item: product?.name || '',
        name_model: product?.model || '',
        name_color: product?.color || '',
        name_quality: product?.quality || 'ORIGINAL',
        brand: product?.brand || orderData?.brand || 'GENERICO',
        color: product?.color || orderData?.color || 'SINCOLOR',
        tipo_documento: orderData?.tipo_documento || '65ae74b9f978d87a5c41fd2a',
        imeis: orderData?.imeis || [],
        numero_documento: `ORD-${orderData?.orderNumber || 'N/A'}`,
        id_proveedor: supplierId,
        porcentaje: orderData?.porcentaje || '65ae74b9f978d87a5c41fd2a',
        cantidad: component?.quantity || 1,
        precioventa: component?.salePrice || 0,
        preciounit: component?.purchasePrice || 0,
        observaciones: component?.observations || component?.description || '',
      };

      this.logger.debug(`[syncProduct] id_item: ${payload.id_item}, sku: ${payload.sku}, upc: ${payload.upc}`);

      // ✅ Guardar el income
      const result = await this.saveIncomeFromOrder(payload);

      this.logger.log(`✅ Producto ${product?.name || 'N/A'} sincronizado en incomes - SKU: ${inventorySku} - UPC: ${inventoryUpc}`);

      return {
        success: true,
        incomeId: result.incomeId,
        batchId: result.batchId,
        sku: inventorySku,
        upc: inventoryUpc,
        batchNumber: result.batchNumber,
        unitPrice: payload.unit_sales_price,
        quantity: payload.quantity
      };

    } catch (error: any) {
      this.logger.error(`❌ Error sincronizando producto: ${error.message}`);
      this.logger.error(`📄 Stack: ${error.stack}`);
      throw error;
    }
  }

  // ============================================
  // ✅ GENERATE SKU - CORREGIDO
  // ============================================

  async generateSku(
    typeId: string,
    brandId: string,
    colorId: string,
    inventoryName: string = 'INVENTORYFLOW'
  ): Promise<{ sku: string; upc: string }> {
    try {
      // ✅ Obtener los NOMBRES de los IDs
      const typeName = await this.getTypeNameById(typeId);
      const brandName = await this.getBrandNameById(brandId);
      const colorName = await this.getColorNameById(colorId);
      
      return await this.skuGeneratorHelper.generateSku(
        typeName || 'PRODUCTO',
        brandName || 'GENERICO',
        colorName || 'SINCOLOR',
        inventoryName
      );
    } catch (error: any) {
      this.logger.error(`❌ Error generateSku: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // ✅ SAVE INCOME FROM ORDER
  // ============================================

  async saveIncomeFromOrder(data: any): Promise<any> {
    try {
      this.logger.log(`📤 Guardando income desde orden...`);

      if (!data.numero_documento) {
        throw new Error('El número de documento es requerido');
      }
      if (!data.id_item) {
        throw new Error('El ID del item es requerido');
      }

      let itemId: Types.ObjectId;
      if (this.isValidObjectId(data.id_item)) {
        itemId = this.toObjectIdSafe(data.id_item);
      } else {
        this.logger.warn(`⚠️ id_item inválido: ${data.id_item}, usando ID por defecto`);
        itemId = new Types.ObjectId('67f94790d875ff138dfcb165');
      }

      let supplierId: Types.ObjectId;
      if (this.isValidObjectId(data.id_proveedor)) {
        supplierId = this.toObjectIdSafe(data.id_proveedor);
      } else {
        supplierId = new Types.ObjectId('64eccd1c36843268d5d2b6fc');
      }

      const idnumber = await this.findOrCreateDocument(
        data.numero_documento,
        data.tipo_documento || '65ae74b9f978d87a5c41fd2a',
        supplierId,
        data.porcentaje || '65ae74b9f978d87a5c41fd2a'
      );

      if (!idnumber) {
        throw new Error('No se pudo obtener el ID del documento');
      }

      let item = null;
      try {
        item = await this.inventoryFlowModel.findById(itemId).lean();
        if (!item) {
          this.logger.warn(`⚠️ Producto no encontrado: ${itemId}, continuando con datos del payload`);
        } else {
          this.logger.log(`✅ Producto encontrado: ${item.name_nameitems} (${item._id})`);
        }
      } catch (error: any) {
        this.logger.warn(`⚠️ Error buscando producto: ${error.message}`);
      }

      const uuidsave = new Types.ObjectId();
      const typeincome = new Types.ObjectId('65bba1f9089b1af39563eaf5');

      const inco = {
        unit_price: data.preciounit?.toString() || data.unit_price || '0',
        date_income: data.date_income || new Date(),
        observations: data.observaciones || data.observations || '',
        quantity: Number(data.cantidad || data.quantity || 1),
        id_document_number: idnumber,
        id_item: itemId,
        id_coduuid: uuidsave,
        id_status: typeincome,
        unit_sales_price: data.precioventa?.toString() || data.unit_sales_price || '0',
        user_create: data.user_create || data.createdByName || 'Sistema',
        inventory_snapshot: {
          sku: item?.sku || data.sku || '',
          upc: item?.upc || data.upc || '',
          name_item: item?.name_nameitems || data.name_item || '',
          name_model: item?.name_model || data.name_model || '',
          name_color: item?.name_color || data.name_color || '',
          name_quality: item?.name_quality || data.name_quality || 'ORIGINAL',
          inventory_id: data.inventory_id || new Types.ObjectId('67b3bc26b850b543c94ca47d'),
          inventory_name: data.inventory_name || 'INVENTORYFLOW'
        },
        batch_snapshot: {
          batchNumber: null,
          identifiers: []
        }
      };

      const saveincomess = await this.incomeModel.create(inco);
      this.logger.log(`✅ Income guardado: ${saveincomess._id}`);

      let batchResult = null;
      if (item) {
        try {
          const newBatch = await this.createBatchFromIncome({ ...data, id_item: itemId }, saveincomess);
          await this.createStockFromBatch(newBatch, { ...data, id_item: itemId });
          batchResult = {
            batchId: newBatch._id,
            batchNumber: newBatch.batchNumber
          };
          this.logger.log(`✅ Batch creado: ${newBatch._id}`);
        } catch (batchError: any) {
          this.logger.warn(`⚠️ No se pudo crear batch/stock: ${batchError.message}`);
        }
      } else {
        this.logger.warn(`⚠️ No se creó batch porque el item no existe en inventoryflows: ${itemId}`);
      }

      return {
        incomeId: saveincomess._id,
        batchId: batchResult?.batchId || null,
        sku: item?.sku || data.sku,
        upc: item?.upc || data.upc,
        batchNumber: batchResult?.batchNumber || null,
        unitPrice: data.precioventa || data.unit_sales_price || '0',
        quantity: data.cantidad || data.quantity || 1
      };

    } catch (error: any) {
      this.logger.error(`❌ Error en saveIncomeFromOrder: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // ✅ GUARDAR INCOME (método original)
  // ============================================

  async saveIncome(payload: any): Promise<any> {
    try {
      this.logger.log(`📤 Guardando income...`);

      const documentId = await this.findOrCreateDocument(
        payload.numero_documento || 'S/N',
        payload.tipo_documento || '65ae74b9f978d87a5c41fd2a',
        payload.id_proveedor || new Types.ObjectId('64eccd1c36843268d5d2b6fc'),
        payload.porcentaje || '65ae74b9f978d87a5c41fd2a'
      );

      const incomeData = this.buildIncomeData(payload, documentId);
      const newIncome = new this.incomeModel(incomeData);
      const savedIncome = await newIncome.save();
      this.logger.log(`✅ Income guardado: ${savedIncome._id}`);

      try {
        const batch = await this.createBatch(payload, savedIncome);
        this.logger.log(`✅ Batch creado: ${batch._id}`);

        await this.incomeModel.findByIdAndUpdate(savedIncome._id, {
          $set: {
            batch_id: batch._id,
            'batch_snapshot.batchNumber': batch.batchNumber,
            'batch_snapshot.identifiers': batch.identifiers.map((i: any) => i.code)
          }
        });

        await this.createStock(batch, payload);
        this.logger.log(`✅ Stock creado para batch: ${batch._id}`);
      } catch (batchError: any) {
        this.logger.warn(`⚠️ No se pudo crear batch/stock: ${batchError.message}`);
      }

      return {
        success: true,
        data: savedIncome,
        message: 'Income creado exitosamente'
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
  // 🔧 CREAR BATCH (método original) - CON batchNumber
  // ============================================

  private async createBatch(payload: any, income: any): Promise<any> {
    try {
      let itemId: Types.ObjectId;
      if (this.isValidObjectId(payload.id_item)) {
        itemId = this.toObjectIdSafe(payload.id_item);
      } else {
        throw new Error(`ID de item inválido: ${payload.id_item}`);
      }

      const itemInfo = await this.inventoryFlowModel.findById(itemId).lean();
      if (!itemInfo) {
        throw new Error(`❌ No se encontró el item con ID: ${itemId}`);
      }

      const facturaIds = ['65ae74b9f978d87a5c41fd2a', '669fce5292dc8027b82650ea', '67f9a68cd12fb6cca2033ef9'];
      const isBillable = facturaIds.includes(payload.tipo_documento) ? 'yes' : 'no';

      const identifiers = Array.isArray(payload.imeis)
        ? payload.imeis.map((code: string) => ({ code }))
        : [];

      const batchNumber = await this.batchCounterHelper.getNextBatchNumber(itemId);

      const newBatch = new this.batchModel({
        item: itemId,
        sku: payload.sku || itemInfo.sku,
        productName: `${itemInfo.name_nameitems || ''} ${itemInfo.name_model || ''}`.trim() || 'Producto',
        unitPrice: Number(payload.unit_sales_price) || 0,
        hasTax: true,
        isBillable: isBillable,
        batchNumber: batchNumber,
        incomes_id: income._id,
        legacy_incomes_id: [],
        identifiers: identifiers,
        notes: payload.observations || '',
      });

      const savedBatch = await newBatch.save();
      return savedBatch;

    } catch (error: any) {
      this.logger.error(`❌ Error creando batch: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // 🔧 CREAR BATCH DESDE INCOME - CON batchNumber
  // ============================================

  private async createBatchFromIncome(data: any, income: any): Promise<any> {
    try {
      let itemId: Types.ObjectId;
      if (this.isValidObjectId(data.id_item)) {
        itemId = this.toObjectIdSafe(data.id_item);
      } else {
        throw new Error(`ID de item inválido: ${data.id_item}`);
      }

      const itemInfo = await this.inventoryFlowModel.findById(itemId).lean();
      if (!itemInfo) {
        throw new Error(`❌ No se encontró el item en inventoryflows: ${data.id_item}`);
      }

      let isBillable = "no";
      const facturaIds = ['65ae74b9f978d87a5c41fd2a', '669fce5292dc8027b82650ea', '67f9a68cd12fb6cca2033ef9'];
      if (facturaIds.includes(data.tipo_documento)) {
        isBillable = "yes";
      }

      const identifiers = Array.isArray(data.imeis)
        ? data.imeis.map((code: string) => ({ code }))
        : [];

      const batchNumber = await this.batchCounterHelper.getNextBatchNumber(itemId);

      const nuevoBatch = new this.batchModel({
        item: itemId,
        sku: itemInfo.sku || data.sku,
        productName: `${itemInfo.name_nameitems || ''} ${itemInfo.name_model || ''}`.trim() || 'Producto',
        unitPrice: Number(data.precioventa) || 0,
        hasTax: true,
        isBillable: isBillable,
        batchNumber: batchNumber,
        incomes_id: income._id,
        legacy_incomes_id: [],
        identifiers: identifiers,
        notes: data.observaciones || ''
      });

      const savedBatch = await nuevoBatch.save();

      await this.incomeModel.findByIdAndUpdate(income._id, {
        $set: {
          batch_id: savedBatch._id,
          'batch_snapshot.batchNumber': savedBatch.batchNumber,
          'batch_snapshot.identifiers': savedBatch.identifiers.map((i: any) => i.code)
        }
      });

      return savedBatch;

    } catch (error: any) {
      this.logger.error(`❌ Error creando batch: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // 🔧 CREAR STOCK
  // ============================================

  private async createStock(batch: any, payload: any): Promise<any> {
    try {
      const branchId = new Types.ObjectId('64eccd1c36843268d5d2b6fc');
      const branchName = 'PRINCIPAL';
      const quantity = Number(payload.quantity) || 1;

      let stock = await this.branchBatchStockModel.findOne({
        batchId: batch._id,
        branchId: branchId,
        isWarehouse: true
      });

      if (stock) {
        stock.quantity += quantity;
        stock.lastUpdatedAt = new Date();
        return await stock.save();
      }

      const newStock = new this.branchBatchStockModel({
        batchId: batch._id,
        branchId: branchId,
        id_name_inventory: payload.inventory_id || new Types.ObjectId('67b3bc26b850b543c94ca47d'),
        last_item_id: batch.item,
        branchName: branchName,
        quantity: quantity,
        isWarehouse: true,
        status: 'active',
      });

      return await newStock.save();

    } catch (error: any) {
      this.logger.error(`❌ Error creando stock: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // 🔧 CREAR STOCK DESDE BATCH
  // ============================================

  private async createStockFromBatch(batch: any, data: any): Promise<any> {
    try {
      const branchId = new Types.ObjectId('64eccd1c36843268d5d2b6fc');
      const branchName = 'PRINCIPAL';
      const quantity = Number(data.cantidad || data.quantity || 1);

      let itemId: Types.ObjectId;
      if (this.isValidObjectId(data.id_item)) {
        itemId = this.toObjectIdSafe(data.id_item);
      } else {
        throw new Error(`ID de item inválido: ${data.id_item}`);
      }

      const itemInfo = await this.inventoryFlowModel.findById(itemId).lean();
      if (!itemInfo) {
        throw new Error(`❌ No se encontró el item en inventoryflows: ${data.id_item}`);
      }

      let stock = await this.branchBatchStockModel.findOne({
        batchId: batch._id,
        branchId: branchId,
        isWarehouse: true
      });

      if (stock) {
        stock.quantity += quantity;
        stock.lastUpdatedAt = new Date();
        return await stock.save();
      }

      const nuevoStock = new this.branchBatchStockModel({
        batchId: batch._id,
        branchId: branchId,
        id_name_inventory: itemInfo.id_type_inventory || new Types.ObjectId('67b3bc26b850b543c94ca47d'),
        last_item_id: batch.item,
        branchName: branchName,
        quantity: quantity,
        isWarehouse: true,
        status: 'active',
      });

      return await nuevoStock.save();

    } catch (error: any) {
      this.logger.error(`❌ Error creando stock: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // 🔧 BUSCAR O CREAR DOCUMENTO
  // ============================================

  private async findOrCreateDocument(
    documentNumber: string,
    documentType: string,
    supplierId: Types.ObjectId,
    taxPercentageId: string
  ): Promise<Types.ObjectId> {
    try {
      let docTypeId: Types.ObjectId;
      if (this.isValidObjectId(documentType)) {
        docTypeId = this.toObjectIdSafe(documentType);
      } else {
        docTypeId = new Types.ObjectId('65ae74b9f978d87a5c41fd2a');
      }

      let supplierObjectId: Types.ObjectId;
      if (this.isValidObjectId(supplierId)) {
        supplierObjectId = this.toObjectIdSafe(supplierId);
      } else {
        supplierObjectId = new Types.ObjectId('64eccd1c36843268d5d2b6fc');
      }

      let taxId: Types.ObjectId;
      if (this.isValidObjectId(taxPercentageId)) {
        taxId = this.toObjectIdSafe(taxPercentageId);
      } else {
        taxId = new Types.ObjectId('65ae74b9f978d87a5c41fd2a');
      }

      const existing = await this.documentNumberIncomeModel.findOne({
        document_number: documentNumber,
        document_type: docTypeId,
        id_supplier: supplierObjectId
      });

      if (existing) {
        return existing._id;
      }

      const newDoc = new this.documentNumberIncomeModel({
        document_number: documentNumber,
        document_type: docTypeId,
        id_supplier: supplierObjectId,
        id_tax_percentaje: taxId
      });

      const saved = await newDoc.save();
      return saved._id;

    } catch (error: any) {
      this.logger.error(`❌ Error en findOrCreateDocument: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // 🔧 MÉTODOS PRIVADOS AUXILIARES
  // ============================================

  private async getTypeUuid(type: string): Promise<Types.ObjectId> {
    return new Types.ObjectId('6659dafad31672b6ed063b49');
  }

  private async getStatusIncome(status: string): Promise<Types.ObjectId> {
    return new Types.ObjectId('65bba1f9089b1af39563eaf5');
  }

  private buildIncomeData(payload: any, documentId: Types.ObjectId): any {
    const defaultId = new Types.ObjectId();

    return {
      unit_price: this.getField(payload, ['unit_price', 'preciounit', 'unitPrice'], '0'),
      unit_sales_price: this.getField(payload, ['unit_sales_price', 'precioventa', 'unitSalesPrice'], '0'),
      observations: this.getField(payload, ['observations', 'observaciones', 'descripcion', 'description'], ''),
      quantity: Number(this.getField(payload, ['quantity', 'cantidad', 'qty'], 1)),
      date_income: this.getField(payload, ['date_income', 'fecha', 'date', 'createdAt'], new Date()),
      id_document_number: documentId,
      id_item: this.toObjectIdSafe(
        this.getField(payload, ['id_item', 'productId', 'itemId']),
        defaultId
      ),
      id_coduuid: this.toObjectIdSafe(
        this.getField(payload, ['id_coduuid', 'coduuid', 'uuid']),
        defaultId
      ),
      id_status: this.toObjectIdSafe(
        this.getField(payload, ['id_status', 'statusId', 'estadoId']),
        new Types.ObjectId('65bba1f9089b1af39563eaf5')
      ),
      user_create: this.getField(payload, ['user_create', 'usuario', 'user'], 'ordenes'),
      inventory_snapshot: {
        inventory_id: this.toObjectIdSafe(
          this.getField(payload, ['inventory_id', 'inventoryId', 'bodegaId']),
          new Types.ObjectId('67b3bc26b850b543c94ca47d')
        ),
        inventory_name: this.getField(payload, ['inventory_name', 'inventoryName', 'bodega'], 'INVENTORYFLOW'),
        sku: this.getField(payload, ['sku', 'codigo', 'code'], ''),
        upc: this.getField(payload, ['upc', 'codigoBarra', 'barcode'], ''),
        name_item: this.getField(payload, ['name_item', 'nameItem', 'nombre', 'productName'], ''),
        name_model: this.getField(payload, ['name_model', 'nameModel', 'modelo', 'model'], ''),
        name_color: this.getField(payload, ['name_color', 'nameColor', 'color'], ''),
        name_quality: this.getField(payload, ['name_quality', 'nameQuality', 'calidad', 'quality'], 'ORIGINAL')
      },
      batch_snapshot: {
        batchNumber: 0,
        identifiers: []
      }
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

  // ============================================
  // ✅ GETTERS
  // ============================================

  async getTypes(): Promise<any[]> {
    try {
      return await this.typeInventoryFlowModel.find()
        .sort({ type_inventoryflow: 1 })
        .lean();
    } catch (error: any) {
      this.logger.error(`❌ Error getTypes: ${error.message}`);
      return [];
    }
  }

  async getBrands(): Promise<any[]> {
    try {
      return await this.brandModel.find()
        .sort({ name_brands: 1 })
        .lean();
    } catch (error: any) {
      this.logger.error(`❌ Error getBrands: ${error.message}`);
      return [];
    }
  }

  async getColors(): Promise<any[]> {
    try {
      return await this.colorModel.find()
        .sort({ color_name: 1 })
        .lean();
    } catch (error: any) {
      this.logger.error(`❌ Error getColors: ${error.message}`);
      return [];
    }
  }

  async getIncomeById(id: string): Promise<any> {
    try {
      const income = await this.incomeModel.findById(id).lean();
      if (!income) {
        throw new NotFoundException(`Income con ID ${id} no encontrado`);
      }
      return income;
    } catch (error: any) {
      this.logger.error(`❌ Error getIncomeById: ${error.message}`);
      throw error;
    }
  }

  async getIncomesByOrderId(orderId: string): Promise<any[]> {
    try {
      return await this.incomeModel.find({
        'observations': { $regex: `ORDEN ${orderId}`, $options: 'i' }
      }).lean();
    } catch (error: any) {
      this.logger.error(`❌ Error getIncomesByOrderId: ${error.message}`);
      return [];
    }
  }

  async getIncomesByItemId(itemId: string): Promise<any[]> {
    try {
      return await this.incomeModel.find({
        id_item: new Types.ObjectId(itemId)
      }).sort({ createdAt: -1 }).lean();
    } catch (error: any) {
      this.logger.error(`❌ Error getIncomesByItemId: ${error.message}`);
      return [];
    }
  }

  async listIncomes(page: number = 1, limit: number = 10, search?: string): Promise<any> {
    try {
      const skip = (page - 1) * limit;
      const query: any = {};

      if (search) {
        query.$or = [
          { 'inventory_snapshot.name_item': { $regex: search, $options: 'i' } },
          { 'inventory_snapshot.name_model': { $regex: search, $options: 'i' } },
          { 'inventory_snapshot.sku': { $regex: search, $options: 'i' } },
        ];
      }

      const [data, total] = await Promise.all([
        this.incomeModel.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        this.incomeModel.countDocuments(query)
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error: any) {
      this.logger.error(`❌ Error listIncomes: ${error.message}`);
      throw error;
    }
  }

  async getBatchByIncomeId(incomeId: string): Promise<any> {
    try {
      const batch = await this.batchModel.findOne({
        $or: [
          { incomes_id: new Types.ObjectId(incomeId) },
          { legacy_incomes_id: new Types.ObjectId(incomeId) }
        ]
      }).lean();

      if (!batch) {
        throw new NotFoundException(`Batch para income ${incomeId} no encontrado`);
      }
      return batch;
    } catch (error: any) {
      this.logger.error(`❌ Error getBatchByIncomeId: ${error.message}`);
      throw error;
    }
  }

  async getBatchById(id: string): Promise<any> {
    try {
      const batch = await this.batchModel.findById(id).lean();
      if (!batch) {
        throw new NotFoundException(`Batch con ID ${id} no encontrado`);
      }
      return batch;
    } catch (error: any) {
      this.logger.error(`❌ Error getBatchById: ${error.message}`);
      throw error;
    }
  }

  async getStockByBatchId(batchId: string): Promise<any[]> {
    try {
      return await this.branchBatchStockModel.find({
        batchId: new Types.ObjectId(batchId)
      }).lean();
    } catch (error: any) {
      this.logger.error(`❌ Error getStockByBatchId: ${error.message}`);
      return [];
    }
  }

  async getInventoryFlowById(id: string): Promise<any> {
    try {
      const flow = await this.inventoryFlowModel.findById(id).lean();
      if (!flow) {
        throw new NotFoundException(`InventoryFlow con ID ${id} no encontrado`);
      }
      return flow;
    } catch (error: any) {
      this.logger.error(`❌ Error getInventoryFlowById: ${error.message}`);
      throw error;
    }
  }

  async getInventoryFlowBySku(sku: string): Promise<any> {
    try {
      const flow = await this.inventoryFlowModel.findOne({ sku }).lean();
      if (!flow) {
        throw new NotFoundException(`InventoryFlow con SKU ${sku} no encontrado`);
      }
      return flow;
    } catch (error: any) {
      this.logger.error(`❌ Error getInventoryFlowBySku: ${error.message}`);
      throw error;
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