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
import { Quality } from './models/quality.model';
import { NameInventory } from './models/name-inventory.model';
import { Supplier } from './models/supplier.model';

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
    @InjectModel(Quality.name, 'atlas') private qualityModel: Model<Quality>,
    @InjectModel(NameInventory.name, 'atlas') private nameInventoryModel: Model<NameInventory>,
    @InjectModel(Supplier.name, 'atlas') private supplierModel: Model<Supplier>,
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
  // ✅ HELPER - Crear o obtener InventoryFlow (SOLO para syncProduct normal)
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
      
      // 3️⃣ Buscar por SKU (por si el producto ya tiene SKU)
      if (product?.sku) {
        const flow = await this.inventoryFlowModel.findOne({ sku: product.sku }).lean();
        if (flow) {
          this.logger.log(`✅ InventoryFlow encontrado por SKU: ${flow._id}, SKU: ${flow.sku}`);
          return { inventoryFlowId: flow._id, sku: flow.sku, upc: flow.upc || '' };
        }
      }
      
      // 4️⃣ No existe - CREAR NUEVO INVENTORYFLOW
      const nameItemId = await this.getOrCreateInventoryFlowNameItem(product?.name || 'Producto');
      
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
  // ✅ HELPER - Obtener o crear Supplier
  // ============================================

  /**
   * Obtiene o crea un supplier basado en el cliente de la orden
   * @param customerData Datos del cliente desde la orden
   * @returns ObjectId del supplier
   */
  private async getOrCreateSupplier(customerData: any): Promise<Types.ObjectId> {
    try {
      if (!customerData) {
        this.logger.warn('⚠️ No hay datos de cliente, usando supplier por defecto');
        return new Types.ObjectId('67f98baed875ff138dfcb942');
      }

      const ruc = customerData.idNumber || '';
      const firstName = customerData.firstName || '';
      const lastName = customerData.lastName || '';
      const razonSocial = `${firstName} ${lastName}`.trim().toUpperCase() || 'CLIENTE GENERICO';
      
      // Buscar teléfono del contacto principal
      let phone = '';
      if (customerData.contacts && Array.isArray(customerData.contacts) && customerData.contacts.length > 0) {
        const primaryContact = customerData.contacts.find((c: any) => c.isPrimary === true);
        phone = primaryContact?.value || customerData.contacts[0]?.value || '';
      }

      // ✅ VALORES FIJOS
      const rimpeId = new Types.ObjectId('65c53f9f6e66c4bd2ee74479');
      const countrieId = new Types.ObjectId('65c53f9f6e66c4bd2ee74472');

      // 1️⃣ Buscar supplier por RUC
      if (ruc) {
        const existingSupplier = await this.supplierModel.findOne({ ruc }).lean();
        if (existingSupplier) {
          this.logger.log(`✅ Supplier encontrado por RUC: ${ruc} - ${existingSupplier.razon_social}`);
          return existingSupplier._id;
        }
      }

      // 2️⃣ Buscar supplier por razón social
      const existingByName = await this.supplierModel.findOne({ razon_social: razonSocial }).lean();
      if (existingByName) {
        this.logger.log(`✅ Supplier encontrado por razón social: ${razonSocial}`);
        return existingByName._id;
      }

      // 3️⃣ Crear nuevo supplier
      this.logger.log(`📝 Creando nuevo supplier: ${razonSocial} (RUC: ${ruc})`);

      const newSupplier = new this.supplierModel({
        ruc: ruc || '',
        razon_social: razonSocial,
        address: '',
        phone: phone || '',
        email: '',
        rimpe: rimpeId,
        countrie: countrieId,
      });

      const saved = await newSupplier.save();
      this.logger.log(`✅ Supplier creado: ${saved._id} - ${saved.razon_social}`);
      return saved._id;

    } catch (error: any) {
      this.logger.error(`❌ Error creando supplier: ${error.message}`);
      // Si falla, usar supplier por defecto
      return new Types.ObjectId('67f98baed875ff138dfcb942');
    }
  }

  // ============================================
  // ✅ SYNC PRODUCT WITH EXISTING FLOW (CUANDO EL USUARIO SELECCIONA UN INVENTORY FLOW)
  // ============================================

  async syncProductWithExistingInventoryFlow(
    product: any, 
    orderData: any, 
    component: any,
    existingInventoryFlow: any
  ): Promise<any> {
    try {
      // ✅ USAR SKU Y UPC DEL PAYLOAD O DEL INVENTORYFLOW
      const inventorySku = orderData.sku || existingInventoryFlow.sku;
      const inventoryUpc = orderData.upc || existingInventoryFlow.upc || '';
      
      this.logger.log(`📤 Sincronizando producto con InventoryFlow existente: ${inventorySku}`);
      this.logger.log(`📦 Producto: ${product?.name || 'N/A'}`);
      
      // ✅ OBTENER IMEIS DESDE orderData
      const imeis = orderData?.imeis || [];
      this.logger.log(`📱 IMEIS recibidos en syncProductWithExistingInventoryFlow: ${imeis.length} - ${JSON.stringify(imeis)}`);

      // ✅ LOG DE DATOS DEL CLIENTE
      this.logger.log(`👤 customerId recibido en syncProductWithExistingInventoryFlow: ${orderData?.customerId}`);
      this.logger.log(`👤 customerName recibido en syncProductWithExistingInventoryFlow: ${orderData?.customerName}`);
      this.logger.log(`👤 customerContacts recibido en syncProductWithExistingInventoryFlow: ${JSON.stringify(orderData?.customerContacts || [])}`);

      const inventoryFlowId = existingInventoryFlow._id;

      // ✅ ACTUALIZAR SKU Y UPC DEL PRODUCTO CON LOS DEL INVENTORYFLOW
      if (product?.sku !== inventorySku) {
        this.logger.log(`🔄 Actualizando SKU del Product: ${product?.sku || 'sin SKU'} -> ${inventorySku}`);
        await this.productsService.updateSku(product._id, inventorySku);
        product.sku = inventorySku;
      }

      if (product?.upc !== inventoryUpc) {
        this.logger.log(`🔄 Actualizando UPC del Product: ${product?.upc || 'sin UPC'} -> ${inventoryUpc}`);
        await this.productsService.updateUpc(product._id, inventoryUpc);
        product.upc = inventoryUpc;
      }

      // ✅ Construir payload - CON IMEIS Y DATOS DEL CLIENTE
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
        name_item: existingInventoryFlow.name_nameitems || product?.name || '',
        name_model: existingInventoryFlow.name_model || product?.model || '',
        name_color: existingInventoryFlow.name_color || product?.color || '',
        name_quality: existingInventoryFlow.name_quality || product?.quality || 'ORIGINAL',
        brand: product?.brand || orderData?.brand || 'GENERICO',
        color: product?.color || orderData?.color || 'SINCOLOR',
        tipo_documento: orderData?.tipo_documento || '65ae74b9f978d87a5c41fd2b',
        imeis: imeis,
        numero_documento: `ORD-${orderData?.orderNumber || 'N/A'}`,
        // ✅ PASAR customerId, customerName y customerContacts
        customerId: orderData?.customerId || '',
        customerName: orderData?.customerName || '',
        customerContacts: orderData?.customerContacts || [],
        porcentaje: orderData?.porcentaje || '65d7a93e81594c12686310aa',
        cantidad: component?.quantity || 1,
        precioventa: component?.salePrice || 0,
        preciounit: component?.purchasePrice || 0,
        observaciones: component?.observations || component?.description || '',
      };

      this.logger.log(`📦 Payload sku: ${payload.sku}`);
      this.logger.log(`📦 Payload id_item: ${payload.id_item}`);
      this.logger.log(`📱 Payload imeis: ${payload.imeis.length} - ${JSON.stringify(payload.imeis)}`);
      this.logger.log(`👤 Payload customerId: ${payload.customerId}`);
      this.logger.log(`👤 Payload customerName: ${payload.customerName}`);

      const result = await this.saveIncomeFromOrder(payload);

      this.logger.log(`✅ Producto ${product?.name || 'N/A'} sincronizado - SKU: ${inventorySku}`);

      return {
        success: true,
        incomeId: result.incomeId,
        batchId: result.batchId,
        sku: inventorySku,
        upc: inventoryUpc,
        batchNumber: result.batchNumber,
        unitPrice: payload.unit_sales_price,
        quantity: payload.quantity,
        inventoryFlowId: inventoryFlowId,
        imeis: imeis
      };

    } catch (error: any) {
      this.logger.error(`❌ Error sincronizando con InventoryFlow existente: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // ✅ GENERATE SKU - PARA USO EN FRONTEND
  // ============================================

  async generateSku(
    typeId: string,
    brandId: string,
    colorId: string,
    inventoryName: string = 'INVENTORYFLOW'
  ): Promise<{ sku: string; upc: string }> {
    try {
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

        // ✅ OBTENER O CREAR SUPPLIER DESDE DATOS DEL CLIENTE
        let supplierId: Types.ObjectId;
        
        // Construir customerData desde los datos de la orden
        const customerData = {
          idNumber: data.customerId || '',
          firstName: data.customerName?.split(' ')[0] || '',
          lastName: data.customerName?.split(' ').slice(1).join(' ') || '',
          contacts: data.customerContacts || [],
        };

        // Si tenemos customerId, intentar obtener o crear supplier
        if (data.customerId) {
          supplierId = await this.getOrCreateSupplier(customerData);
          this.logger.log(`✅ Supplier obtenido/creado: ${supplierId} para cliente: ${data.customerId}`);
        } else {
          // Si no hay customerId, usar ID por defecto
          supplierId = new Types.ObjectId('67f98baed875ff138dfcb942');
          this.logger.warn(`⚠️ No hay customerId, usando ID por defecto: ${supplierId}`);
        }

        const idnumber = await this.findOrCreateDocument(
          data.numero_documento,
          data.tipo_documento || '65ae74b9f978d87a5c41fd2b',
          supplierId,
          data.porcentaje || '65d7a93e81594c12686310aa'
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

        // ✅ OBTENER IMEIS DEL DISPOSITIVO (desde data.imeis)
        const imeis = data.imeis || [];

        this.logger.log(`📱 IMEIs recibidos: ${imeis.length} - ${JSON.stringify(imeis)}`);

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
          imeis: imeis,
          // ✅ GUARDAR EL SUPPLIER ID EN EL INCOME
          id_supplier: supplierId,
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
        this.logger.log(`✅ Income guardado: ${saveincomess._id} con ${imeis.length} IMEIs y supplier: ${supplierId}`);

        let batchResult = null;
        if (item) {
          try {
            const newBatch = await this.createBatchFromIncome({ ...data, id_item: itemId, imeis: imeis }, saveincomess);
            await this.createStockFromBatch(newBatch, { ...data, id_item: itemId });
            batchResult = {
              batchId: newBatch._id,
              batchNumber: newBatch.batchNumber
            };
            this.logger.log(`✅ Batch creado: ${newBatch._id} con ${newBatch.identifiers?.length || 0} identifiers`);
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
          quantity: data.cantidad || data.quantity || 1,
          imeis: imeis,
          supplierId: supplierId
        };

      } catch (error: any) {
        this.logger.error(`❌ Error en saveIncomeFromOrder: ${error.message}`);
        throw error;
      }
  }

  async saveIncome(payload: any): Promise<any> {
    try {
      this.logger.log(`📤 Guardando income directamente...`);

      // Validar campos requeridos
      if (!payload.id_item) {
        throw new Error('El ID del item es requerido');
      }

      // Obtener o crear documento
      const documentId = await this.findOrCreateDocument(
        payload.numero_documento || `INC-${Date.now()}`,
        payload.tipo_documento || '65ae74b9f978d87a5c41fd2b',
        payload.id_proveedor || new Types.ObjectId('67f98baed875ff138dfcb942'),
        payload.porcentaje || '65d7a93e81594c12686310aa'
      );

      // Construir income
      const inco = {
        unit_price: payload.preciounit?.toString() || payload.unit_price || '0',
        date_income: payload.date_income || new Date(),
        observations: payload.observaciones || payload.observations || '',
        quantity: Number(payload.cantidad || payload.quantity || 1),
        id_document_number: documentId,
        id_item: this.toObjectIdSafe(payload.id_item),
        id_coduuid: new Types.ObjectId(),
        id_status: new Types.ObjectId('65bba1f9089b1af39563eaf5'),
        unit_sales_price: payload.precioventa?.toString() || payload.unit_sales_price || '0',
        user_create: payload.user_create || payload.createdByName || 'Sistema',
        inventory_snapshot: {
          sku: payload.sku || '',
          upc: payload.upc || '',
          name_item: payload.name_item || '',
          name_model: payload.name_model || '',
          name_color: payload.name_color || '',
          name_quality: payload.name_quality || 'ORIGINAL',
          inventory_id: payload.inventory_id || new Types.ObjectId('67b3bc26b850b543c94ca47d'),
          inventory_name: payload.inventory_name || 'INVENTORYFLOW'
        },
        batch_snapshot: {
          batchNumber: null,
          identifiers: payload.imeis || []
        }
      };

      const savedIncome = await this.incomeModel.create(inco);
      this.logger.log(`✅ Income guardado: ${savedIncome._id}`);

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
  // 🔧 CREAR BATCH DESDE INCOME
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
      const facturaIds = [
        '65ae74b9f978d87a5c41fd2a',  // FACTURA
        '669fce5292dc8027b82650ea',  // LIQUIDACION
        '67f9a68cd12fb6cca2033ef9',  // NOTA DE VENTA
        '65ae74b9f978d87a5c41fd2b',  // ORDEN (si aplica)
      ];
      if (facturaIds.includes(data.tipo_documento)) {
        isBillable = "no";
      }

      // ✅ OBTENER IMEIS DE VARIAS FUENTES
      let identifiers = [];

      // 1️⃣ Primero, desde data.imeis (viene del frontend)
      if (data.imeis && Array.isArray(data.imeis) && data.imeis.length > 0) {
        this.logger.log(`📱 Procesando ${data.imeis.length} IMEIs desde el payload`);
        identifiers = data.imeis.map((code: string) => ({ code }));
      }
      // 2️⃣ Si no hay, desde income.imeis
      else if (income?.imeis && Array.isArray(income.imeis) && income.imeis.length > 0) {
        this.logger.log(`📱 Procesando ${income.imeis.length} IMEIs desde income`);
        identifiers = income.imeis.map((imei: string) => ({ code: imei }));
      }
      // 3️⃣ Si no hay, desde data.identifiers
      else if (data.identifiers && Array.isArray(data.identifiers) && data.identifiers.length > 0) {
        this.logger.log(`📱 Procesando ${data.identifiers.length} identifiers desde data`);
        identifiers = data.identifiers.map((id: any) => ({ code: id.code || id }));
      }

      this.logger.log(`📱 Total identifiers para batch: ${identifiers.length}`);

      // ✅ OBTENER EL BATCH NUMBER SECUENCIAL
      const batchNumber = await this.batchCounterHelper.getNextBatchNumber(itemId);
      this.logger.log(`📦 Batch number obtenido: ${batchNumber}`);

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
        identifiers: identifiers, // ✅ AHORA CON IMEIS
        notes: data.observaciones || data.notes || ''
      });

      const savedBatch = await nuevoBatch.save();
      this.logger.log(`✅ Batch creado con batchNumber: ${savedBatch.batchNumber} y ${savedBatch.identifiers.length} identifiers`);

      // ✅ Actualizar el income con el batch y los identifiers
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
        docTypeId = new Types.ObjectId('65ae74b9f978d87a5c41fd2b');
      }

      let supplierObjectId: Types.ObjectId;
      if (this.isValidObjectId(supplierId)) {
        supplierObjectId = this.toObjectIdSafe(supplierId);
      } else {
        supplierObjectId = new Types.ObjectId('67f98baed875ff138dfcb942');
      }

      let taxId: Types.ObjectId;
      if (this.isValidObjectId(taxPercentageId)) {
        taxId = this.toObjectIdSafe(taxPercentageId);
      } else {
        taxId = new Types.ObjectId('65d7a93e81594c12686310aa');
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

  async getQualities(): Promise<any[]> {
    try {
      return await this.qualityModel.find()
        .sort({ quality_inventoryflow: 1 })
        .lean();
    } catch (error: any) {
      this.logger.error(`❌ Error getQualities: ${error.message}`);
      return [];
    }
  }

  async getInventories(): Promise<any[]> {
    try {
      this.logger.log('📤 Obteniendo lista de inventarios...');
      
      const inventories = await this.nameInventoryModel.find()
        .sort({ inventory_name: 1 })
        .lean()
        .exec();
      
      this.logger.log(`✅ ${inventories.length} inventarios encontrados`);
      return inventories;
    } catch (error: any) {
      this.logger.error(`❌ Error getInventories: ${error.message}`);
      throw error;
    }
  }

  async getInventoryFlowById(id: string): Promise<any> {
    try {
      const flow = await this.inventoryFlowModel.findById(id).lean();
      if (!flow) {
        throw new NotFoundException(`InventoryFlow con ID ${id} no encontrado`);
      }
      
      this.logger.log(`✅ InventoryFlow encontrado: ${flow._id} - SKU: ${flow.sku}`);
      return flow;
    } catch (error: any) {
      this.logger.error(`❌ Error getInventoryFlowById: ${error.message}`);
      throw error;
    }
  }

  async searchInventoryFlowItems(query: any): Promise<any> {
    try {
      const searchTerm = query.q || '';
      const inventoryId = query.inventoryId || null;
      const limit = parseInt(query.limit) || 20;
      const page = parseInt(query.page) || 1;
      const skip = (page - 1) * limit;

      const filter: any = {};

      if (inventoryId) {
        filter.id_type_inventory = new Types.ObjectId(inventoryId);
      }

      if (searchTerm) {
        filter.$or = [
          { sku: { $regex: searchTerm, $options: 'i' } },
          { name_nameitems: { $regex: searchTerm, $options: 'i' } },
          { name_model: { $regex: searchTerm, $options: 'i' } },
          { upc: { $regex: searchTerm, $options: 'i' } },
        ];
      }

      const [items, total] = await Promise.all([
        this.inventoryFlowModel.find(filter)
          .sort({ name_nameitems: 1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.inventoryFlowModel.countDocuments(filter),
      ]);

      const inventoryIds = items
        .map(item => item.id_type_inventory)
        .filter(id => id);

      let inventoryNames: any[] = [];
      if (inventoryIds.length > 0) {
        inventoryNames = await this.nameInventoryModel.find({
          _id: { $in: inventoryIds }
        }).lean().exec();
      }

      const inventoryNameMap = new Map();
      inventoryNames.forEach(n => {
        inventoryNameMap.set(n._id.toString(), n.inventory_name);
      });

      return {
        success: true,
        data: items.map(item => ({
          _id: item._id,
          sku: item.sku || '',
          upc: item.upc || '',
          name: item.name_nameitems || '',
          brand: '',
          model: item.name_model || '',
          type: '',
          color: item.name_color || '',
          quality: item.name_quality || '',
          condition: '',
          purchasePrice: null,
          salePrice: null,
          stockQuantity: 0,
          name_item: item.name_nameitems,
          name_model: item.name_model,
          name_color: item.name_color,
          name_quality: item.name_quality,
          id_type_inventory: item.id_type_inventory,
          inventory_name: inventoryNameMap.get(item.id_type_inventory?.toString()) || '',
          inventoryFlowId: item._id,
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      this.logger.error(`❌ Error buscando ítems en inventoryflow: ${error.message}`);
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

  async syncProductNormal(product: any, orderData: any, component: any): Promise<any> {
    try {
      this.logger.log(`📤 Sincronizando producto normal: ${product?.name || 'N/A'}`);
      
      // ✅ LOG DEL COMPONENTE PARA VERIFICAR
      this.logger.log(`📦 Componente recibido:`, JSON.stringify({
        name: component?.name,
        inventoryFlowId: component?.inventoryFlowId,
        inventoryFlowSku: component?.inventoryFlowSku,
        inventoryFlowUpc: component?.inventoryFlowUpc
      }));

      let inventoryFlowId: Types.ObjectId;
      let inventorySku: string;
      let inventoryUpc: string;

      // ✅ SI EL COMPONENTE TIENE inventoryFlowId, USARLO
      if (component?.inventoryFlowId) {
        this.logger.log(`🔍 Buscando InventoryFlow por ID: ${component.inventoryFlowId}`);
        
        // Buscar el InventoryFlow por ID
        const existingFlow = await this.inventoryFlowModel.findById(component.inventoryFlowId).lean();
        
        if (existingFlow) {
          inventoryFlowId = existingFlow._id;
          inventorySku = existingFlow.sku || component.inventoryFlowSku || '';
          inventoryUpc = existingFlow.upc || component.inventoryFlowUpc || '';
          this.logger.log(`✅ Usando InventoryFlow del componente: ${inventorySku} (${inventoryFlowId})`);
        } else {
          this.logger.warn(`⚠️ InventoryFlow no encontrado: ${component.inventoryFlowId}, creando uno nuevo por nombre`);
          // Si no existe, crear uno nuevo
          const result = await this.getOrCreateInventoryFlow(product, orderData);
          inventoryFlowId = result.inventoryFlowId;
          inventorySku = result.sku;
          inventoryUpc = result.upc;
        }
      } else {
        // ✅ Crear o obtener InventoryFlow por nombre (comportamiento original)
        this.logger.log(`ℹ️ No hay inventoryFlowId en el componente, creando/obteniendo por nombre`);
        const result = await this.getOrCreateInventoryFlow(product, orderData);
        inventoryFlowId = result.inventoryFlowId;
        inventorySku = result.sku;
        inventoryUpc = result.upc;
      }

      // ✅ Actualizar SKU y UPC del producto SOLO SI ES DIFERENTE
      if (product?.sku !== inventorySku) {
        this.logger.log(`🔄 Actualizando SKU del Product: ${product?.sku || 'sin SKU'} -> ${inventorySku}`);
        await this.productsService.updateSku(product._id, inventorySku);
        product.sku = inventorySku;
      }

      if (product?.upc !== inventoryUpc) {
        this.logger.log(`🔄 Actualizando UPC del Product: ${product?.upc || 'sin UPC'} -> ${inventoryUpc}`);
        await this.productsService.updateUpc(product._id, inventoryUpc);
        product.upc = inventoryUpc;
      }

      // ✅ Validar customerId
      let supplierId: Types.ObjectId;
      if (orderData?.customerId && this.isValidObjectId(orderData.customerId)) {
        supplierId = this.toObjectIdSafe(orderData.customerId);
      } else {
        supplierId = new Types.ObjectId('67f98baed875ff138dfcb942');
        this.logger.warn(`⚠️ customerId inválido, usando ID por defecto: ${supplierId}`);
      }

      // ✅ Construir payload con los datos correctos
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
        tipo_documento: orderData?.tipo_documento || '65ae74b9f978d87a5c41fd2b',
        imeis: orderData?.imeis || [],
        customerId: orderData?.customerId || '',
        customerName: orderData?.customerName || '',
        customerContacts: orderData?.customerContacts || [],
        numero_documento: `ORD-${orderData?.orderNumber || 'N/A'}`,
        id_proveedor: supplierId,
        porcentaje: orderData?.porcentaje || '65d7a93e81594c12686310aa',
        cantidad: component?.quantity || 1,
        precioventa: component?.salePrice || 0,
        preciounit: component?.purchasePrice || 0,
        observaciones: component?.observations || component?.description || '',
      };

      this.logger.log(`📦 Payload id_item: ${payload.id_item}`);
      this.logger.log(`📦 Payload sku: ${payload.sku}`);

      const result = await this.saveIncomeFromOrder(payload);

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
      this.logger.error(`❌ Error sincronizando producto normal: ${error.message}`);
      throw error;
    }
  }
}