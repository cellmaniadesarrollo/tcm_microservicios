// microservicio-inventario/src/products/products.service.ts

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument, ProductStatus } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InventoryMovementDto, MovementType } from './dto/inventory-movement.dto';
import { StatusChangeDto } from './dto/status-change.dto';
import { IncomeBackendService } from '../integrations/income-backend.service';
import { SkuGeneratorHelper } from '../integrations/helpers/sku-generator.helper';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  
  constructor(
    @InjectModel(Product.name, 'default') private productModel: Model<ProductDocument>,
    @Inject(forwardRef(() => IncomeBackendService)) private incomeBackendService: IncomeBackendService,
    private skuGeneratorHelper: SkuGeneratorHelper,
  ) {
    this.logger.log('✅ ProductsService inicializado');
  }

  private async generateProductCode(): Promise<string> {
    const prefix = 'INV';
    const date = new Date();
    const dateStr =
      date.getFullYear().toString() +
      String(date.getMonth() + 1).padStart(2, '0') +
      String(date.getDate()).padStart(2, '0');

    const count = await this.productModel.countDocuments({
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lt: new Date(new Date().setHours(23, 59, 59, 999)),
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();

    return `${prefix}-${dateStr}-${sequence}-${random}`;
  }

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

  private cleanString(value: string): string {
    if (!value) return '';
    return value
      .toUpperCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 8);
  }

  private updateLowStockStatus(product: ProductDocument): void {
    product.isLowStock = product.stockQuantity <= product.minStockThreshold;
    if (product.stockQuantity > product.minStockThreshold) {
      product.lowStockAlertSentAt = null;
    }
  }

  async create(createProductDto: CreateProductDto): Promise<ProductDocument> {
    const isFromOrder = createProductDto.metadata?.fromOrder === true;

    // ✅ Los productos COMPLETO (dispositivos seriados con IMEI) nunca deben
    // fusionarse por stock: cada unidad física es un producto/documento distinto,
    // aunque coincidan name+brand+model+color. Solo se fusiona stock para PARTE.
    const isSerializedDevice = createProductDto.type === 'COMPLETO';

    const existing = isSerializedDevice
      ? null
      : await this.productModel.findOne({
          name: createProductDto.name,
          brand: createProductDto.brand,
          model: createProductDto.model,
          color: createProductDto.color,
          isDeleted: false,
        });

    if (existing && isFromOrder) {
      this.logger.log(`📦 Producto existente encontrado: ${existing.code}, actualizando stock`);
      
      const quantity = createProductDto.stockQuantity || 1;
      const previousQuantity = existing.stockQuantity || 0;
      existing.stockQuantity = previousQuantity + quantity;
      existing.updatedAt = new Date();
      
      existing.inventoryHistory.push({
        productId: existing._id,
        previousQuantity: previousQuantity,
        newQuantity: existing.stockQuantity,
        movementType: 'ENTRADA',
        reason: `Ingreso desde orden ${createProductDto.metadata?.orderNumber || 'N/A'}`,
        performedBy: createProductDto.createdById,
        performedByName: createProductDto.createdByName,
        performedAt: new Date(),
        relatedOrderId: createProductDto.metadata?.orderId,
      });
      
      if (createProductDto.metadata) {
        existing.metadata = {
          ...existing.metadata,
          lastOrderId: createProductDto.metadata.orderId,
          lastOrderNumber: createProductDto.metadata.orderNumber,
          lastOrderDate: new Date(),
          fromOrder: true,
        };
      }
      
      this.updateLowStockStatus(existing);
      await existing.save();
      return existing;
    }

    if (existing && !isFromOrder) {
      throw new ConflictException('Ya existe un producto con estas características');
    }

    const code = createProductDto.code || (await this.generateProductCode());
    const quality = createProductDto.quality || 'B';

    const product = new this.productModel({
      ...createProductDto,
      code,
      quality,
      createdAt: new Date(),
      updatedAt: new Date(),
      statusHistory: [
        {
          fromStatus: null,
          toStatus: createProductDto.status || ProductStatus.ACTIVO,
          changedBy: createProductDto.createdById,
          changedByName: createProductDto.createdByName,
          changedAt: new Date(),
          reason: 'Creación del producto',
        },
      ],
    });

    this.updateLowStockStatus(product);

    if (product.stockQuantity > 0) {
      product.inventoryHistory.push({
        productId: product._id,
        previousQuantity: 0,
        newQuantity: product.stockQuantity,
        movementType: 'ENTRADA',
        reason: 'Stock inicial',
        performedBy: createProductDto.createdById,
        performedByName: createProductDto.createdByName,
        performedAt: new Date(),
      });
    }

    return await product.save();
  }

  async findAll(filters: any = {}): Promise<ProductDocument[]> {
    const query: any = { isDeleted: false };

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { brand: { $regex: filters.search, $options: 'i' } },
        { model: { $regex: filters.search, $options: 'i' } },
        { code: { $regex: filters.search, $options: 'i' } },
        { sku: { $regex: filters.search, $options: 'i' } },
        { upc: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const filtersMap = {
      brand: 'brand',
      model: 'model',
      type: 'type',
      color: 'color',
      condition: 'condition',
      status: 'status',
      categoryId: 'categoryId',
      quality: 'quality',
    };

    Object.entries(filtersMap).forEach(([key, field]) => {
      if (filters[key] !== undefined && filters[key] !== '') {
        query[field] = filters[key];
      }
    });

    if (filters.minStock !== undefined) {
      query.stockQuantity = { $gte: filters.minStock };
    }

    if (filters.maxStock !== undefined) {
      query.stockQuantity = { ...query.stockQuantity, $lte: filters.maxStock };
    }

    if (filters.isLowStock !== undefined) {
      query.isLowStock = filters.isLowStock;
    }

    // ✅ Filtros sobre metadata: permiten distinguir en el listado qué productos
    // se crearon desde una orden (metadata.fromOrder), desde un InventoryFlow
    // seleccionado (metadata.fromInventoryFlow), o por número de orden / flow.
    // Los query params llegan como string, por eso se normalizan a boolean.
    const toBool = (v: any) => v === true || v === 'true';

    if (filters.fromOrder !== undefined) {
      query['metadata.fromOrder'] = toBool(filters.fromOrder);
    }

    if (filters.fromInventoryFlow !== undefined) {
      query['metadata.fromInventoryFlow'] = toBool(filters.fromInventoryFlow);
    }

    if (filters.orderNumber !== undefined && filters.orderNumber !== '') {
      const orderNumberValue = isNaN(Number(filters.orderNumber))
        ? filters.orderNumber
        : Number(filters.orderNumber);
      query['metadata.orderNumber'] = orderNumberValue;
    }

    if (filters.inventoryFlowId !== undefined && filters.inventoryFlowId !== '') {
      query['metadata.inventoryFlowId'] = filters.inventoryFlowId;
    }

    return await this.productModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit || 100)
      .skip(filters.offset || 0)
      .exec();
  }

  async findOne(id: string): Promise<ProductDocument> {
    const product = await this.productModel.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    return product;
  }

  async findByCode(code: string): Promise<ProductDocument> {
    const product = await this.productModel.findOne({
      code: code.toUpperCase(),
      isDeleted: false,
    });

    if (!product) {
      throw new NotFoundException(`Producto con código ${code} no encontrado`);
    }

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<ProductDocument> {
    const product = await this.findOne(id);

    if (
      updateProductDto.stockQuantity !== undefined &&
      updateProductDto.stockQuantity !== product.stockQuantity
    ) {
      product.inventoryHistory.push({
        productId: product._id,
        previousQuantity: product.stockQuantity,
        newQuantity: updateProductDto.stockQuantity,
        movementType:
          updateProductDto.stockQuantity > product.stockQuantity ? 'ENTRADA' : 'SALIDA',
        reason: updateProductDto.updateReason || 'Actualización de stock',
        performedBy: updateProductDto.lastUpdatedById || product.lastUpdatedById,
        performedByName: updateProductDto.lastUpdatedByName || product.lastUpdatedByName,
        performedAt: new Date(),
      });
    }

    Object.assign(product, updateProductDto);
    product.updatedAt = new Date();
    product.lastUpdatedById = updateProductDto.lastUpdatedById || product.lastUpdatedById;
    product.lastUpdatedByName = updateProductDto.lastUpdatedByName || product.lastUpdatedByName;

    this.updateLowStockStatus(product);

    return await product.save();
  }

  async inventoryMovement(id: string, movementDto: InventoryMovementDto): Promise<ProductDocument> {
    const product = await this.findOne(id);

    let newQuantity = product.stockQuantity;

    switch (movementDto.movementType) {
      case MovementType.ENTRADA:
        newQuantity += movementDto.quantity;
        break;
      case MovementType.SALIDA:
        if (product.stockQuantity < movementDto.quantity) {
          throw new BadRequestException(
            `Stock insuficiente. Disponible: ${product.stockQuantity}`,
          );
        }
        newQuantity -= movementDto.quantity;
        break;
      case MovementType.AJUSTE:
        newQuantity = movementDto.quantity;
        break;
    }

    product.inventoryHistory.push({
      productId: product._id,
      previousQuantity: product.stockQuantity,
      newQuantity,
      movementType: movementDto.movementType,
      reason: movementDto.reason,
      performedBy: movementDto.performedBy,
      performedByName: movementDto.performedByName,
      performedAt: new Date(),
      relatedOrderId: movementDto.relatedOrderId,
      relatedDeviceId: movementDto.relatedDeviceId,
      observations: movementDto.observations,
    });

    product.stockQuantity = newQuantity;
    product.updatedAt = new Date();

    this.updateLowStockStatus(product);

    return await product.save();
  }

  async changeStatus(id: string, statusChangeDto: StatusChangeDto): Promise<ProductDocument> {
    const product = await this.findOne(id);
    const previousStatus = product.status;

    if (previousStatus === statusChangeDto.newStatus) {
      throw new BadRequestException(`El producto ya tiene el estado ${statusChangeDto.newStatus}`);
    }

    product.statusHistory.push({
      fromStatus: previousStatus,
      toStatus: statusChangeDto.newStatus,
      changedBy: statusChangeDto.changedBy,
      changedByName: statusChangeDto.changedByName,
      changedAt: new Date(),
      reason: statusChangeDto.reason,
      observations: statusChangeDto.observations,
    });

    product.status = statusChangeDto.newStatus;
    product.updatedAt = new Date();

    return await product.save();
  }

  async softDelete(id: string, deletedBy?: string, deletedByName?: string): Promise<void> {
    const product = await this.findOne(id);

    product.isDeleted = true;
    product.deletedAt = new Date();
    product.deletedById = deletedBy;
    product.deletedByName = deletedByName;
    product.status = ProductStatus.INACTIVO;
    product.updatedAt = new Date();

    await product.save();
  }

  async restore(id: string): Promise<ProductDocument> {
    const product = await this.productModel.findOne({
      _id: id,
      isDeleted: true,
    });

    if (!product) {
      throw new NotFoundException(`Producto eliminado con ID ${id} no encontrado`);
    }

    product.isDeleted = false;
    product.deletedAt = null;
    product.deletedById = null;
    product.deletedByName = null;
    product.status = ProductStatus.ACTIVO;
    product.updatedAt = new Date();

    return await product.save();
  }

  async findLowStock(): Promise<ProductDocument[]> {
    return await this.productModel
      .find({
        isDeleted: false,
        status: ProductStatus.ACTIVO,
        isLowStock: true,
      })
      .exec();
  }

  async getStats(): Promise<any> {
    const [total, active, lowStock, totalStock, byCondition, byStatus, byBrand] =
      await Promise.all([
        this.productModel.countDocuments({ isDeleted: false }),
        this.productModel.countDocuments({ isDeleted: false, status: ProductStatus.ACTIVO }),
        this.productModel.countDocuments({ isDeleted: false, isLowStock: true }),
        this.productModel.aggregate([
          { $match: { isDeleted: false } },
          { $group: { _id: null, total: { $sum: '$stockQuantity' } } },
        ]),
        this.productModel.aggregate([
          { $match: { isDeleted: false } },
          { $group: { _id: '$condition', count: { $sum: 1 } } },
        ]),
        this.productModel.aggregate([
          { $match: { isDeleted: false } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        this.productModel.aggregate([
          { $match: { isDeleted: false } },
          { $group: { _id: '$brand', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
      ]);

    return {
      total,
      active,
      lowStock,
      totalStock: totalStock[0]?.total || 0,
      byCondition: byCondition.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
      byStatus: byStatus.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
      topBrands: byBrand,
      timestamp: new Date(),
    };
  }

  async advancedSearch(searchParams: any): Promise<ProductDocument[]> {
    const query: any = { isDeleted: false };

    if (searchParams.text) {
      query.$text = { $search: searchParams.text };
    }

    if (searchParams.priceMin || searchParams.priceMax) {
      query.salePrice = {};
      if (searchParams.priceMin) query.salePrice.$gte = searchParams.priceMin;
      if (searchParams.priceMax) query.salePrice.$lte = searchParams.priceMax;
    }

    if (searchParams.stockMin !== undefined) {
      query.stockQuantity = { $gte: searchParams.stockMin };
    }

    const sortOptions: any = {};
    if (searchParams.sortBy) {
      sortOptions[searchParams.sortBy] = searchParams.sortOrder || -1;
    }

    return await this.productModel
      .find(query)
      .sort(sortOptions)
      .limit(searchParams.limit || 50)
      .skip(searchParams.offset || 0)
      .exec();
  }

  async updateFromOrderEvent(orderData: any): Promise<void> {
    if (orderData.deviceId) {
      const product = await this.productModel.findOne({
        deviceId: orderData.deviceId,
        isDeleted: false,
      });

      if (product) {
        product.lastOrderId = orderData.orderId;
        product.lastOrderNumber = orderData.orderNumber;
        product.lastOrderDate = new Date();
        await product.save();
        
        this.logger?.log(`Product ${product.code} updated from order ${orderData.orderNumber}`);
      }
    }
  }

  // ============================================
  // ✅ CREATE FROM ORDER
  // ============================================

  async createFromOrder(data: any): Promise<any> {
    try {
      this.logger.log(`📦 Procesando orden ${data.orderNumber} - Tipo: ${data.type}`);
      this.logger.log(`📦 inventoryFlowId recibido: ${data.inventoryFlowId}`);
      this.logger.log(`📦 sku recibido: ${data.sku}`);
      this.logger.log(`📦 upc recibido: ${data.upc}`);
      this.logger.log(`📱 IMEIS recibidos en createFromOrder: ${data.imeis?.length || 0} - ${JSON.stringify(data.imeis || [])}`);
      
      const results = [];
      
      for (const component of data.components) {
        const quality = component.quality || 'B';
        const isFromInventoryFlow = Boolean(data.inventoryFlowId);
        const isSerializedDevice = (component.type || data.type) === 'COMPLETO';
        
        let product;
        
        if (isFromInventoryFlow) {
          // ✅ OBTENER EL INVENTORYFLOW SELECCIONADO
          const existingInventoryFlow = await this.incomeBackendService.getInventoryFlowById(data.inventoryFlowId);
          
          if (!existingInventoryFlow) {
            throw new Error(`Inventory flow ${data.inventoryFlowId} no encontrado`);
          }

          this.logger.log(`✅ InventoryFlow encontrado: ${existingInventoryFlow.sku} - ${existingInventoryFlow.name_nameitems}`);
          
          const skuToUse = data.sku || existingInventoryFlow.sku;
          const upcToUse = data.upc || existingInventoryFlow.upc || '';
          
          this.logger.log(`📦 SKU a usar: ${skuToUse}`);
          this.logger.log(`📦 UPC a usar: ${upcToUse}`);
          
          // ✅ Buscar producto existente por SKU
          const existingProduct = await this.productModel.findOne({
            sku: skuToUse,
            isDeleted: false,
          });
          
          if (existingProduct && !isSerializedDevice) {
            const quantity = component.quantity || 1;
            existingProduct.stockQuantity = (existingProduct.stockQuantity || 0) + quantity;
            existingProduct.updatedAt = new Date();
            await existingProduct.save();
            product = existingProduct;
            this.logger.log(`📦 Stock actualizado en producto existente: ${product.code}`);
          } else {
            // ✅ Crear producto
            const productData: CreateProductDto = {
              name: component.name || existingInventoryFlow.name_nameitems || 'Dispositivo',
              brand: component.brand || 'Genérico',
              model: component.model || existingInventoryFlow.name_model || 'Dispositivo',
              type: component.type || (data.type === 'COMPLETO' ? 'DISPOSITIVO' : 'PARTE'),
              color: component.color || existingInventoryFlow.name_color || 'No especificado',
              quality: quality,
              condition: (component.condition || 'NUEVO') as any,
              status: ProductStatus.ACTIVO,
              observations: component.description || `Ingreso desde orden ${data.orderNumber}`,
              deviceId: data.deviceId,
              purchasePrice: component.purchasePrice || null,
              salePrice: component.salePrice || null,
              stockQuantity: component.quantity || 1,
              minStockThreshold: 1,
              createdById: data.createdById,
              createdByName: data.createdByName,
              supplierName: data.customerName,
              sku: skuToUse,
              upc: upcToUse,
              metadata: {
                fromOrder: true,
                orderId: data.orderId,
                orderNumber: data.orderNumber,
                type: data.type,
                customerName: data.customerName,
                customerId: data.customerId,
                componentName: component.name,
                fromInventoryFlow: true,
                inventoryFlowId: data.inventoryFlowId,
              },
            };

            product = await this.create(productData);
            this.logger.log(`📦 Nuevo producto creado: ${product.code} - SKU: ${product.sku}`);
          }
          
          // ✅ CONSTRUIR syncData CON IMEIS EXPLÍCITOS
          const syncData = {
            orderId: data.orderId,
            orderNumber: data.orderNumber,
            deviceId: data.deviceId,
            deviceName: data.deviceName,
            deviceColor: data.deviceColor,
            customerName: data.customerName,
            customerId: data.customerId,
            brand: component.brand || data.brand,
            color: component.color || data.deviceColor,
            sku: skuToUse,
            upc: upcToUse,
            // ✅ PASAR IMEIS EXPLÍCITAMENTE
            imeis: data.imeis || [],
            orderPublicId: data.public_id || null,
            inventory_id: data.inventory_id || new Types.ObjectId('67b3bc26b850b543c94ca47d'),
            inventory_name: data.inventory_name || 'INVENTORYFLOW',
            tipo_documento: data.tipo_documento || '65ae74b9f978d87a5c41fd2b',
            porcentaje: data.porcentaje || '65d7a93e81594c12686310aa',
            createdByName: data.createdByName,
            createdById: data.createdById,
          };
          
          this.logger.log(`📱 syncData.imeis: ${syncData.imeis.length} - ${JSON.stringify(syncData.imeis)}`);
          
          // ✅ Sincronizar con el InventoryFlow PASANDO syncData CON IMEIS
          await this.incomeBackendService.syncProductWithExistingInventoryFlow(
            product,
            syncData,  // ✅ Aquí pasamos syncData con los IMEIS
            component,
            existingInventoryFlow
          );
          
        } else {
          // ✅ CREACIÓN NORMAL (sin InventoryFlow seleccionado)
          const productData: CreateProductDto = {
            name: component.name,
            brand: component.brand || data.deviceName?.split(' ')[0] || 'Genérico',
            model: component.model || data.deviceName || 'Dispositivo',
            type: component.type || (data.type === 'COMPLETO' ? 'DISPOSITIVO' : 'PARTE'),
            color: component.color || data.deviceColor || 'No especificado',
            quality: quality,
            condition: (component.condition || 'NUEVO') as any,
            status: ProductStatus.ACTIVO,
            observations: component.description || `Ingreso desde orden ${data.orderNumber}`,
            deviceId: data.deviceId,
            purchasePrice: component.purchasePrice || null,
            salePrice: component.salePrice || null,
            stockQuantity: component.quantity || 1,
            minStockThreshold: 1,
            createdById: data.createdById,
            createdByName: data.createdByName,
            supplierName: data.customerName,
            metadata: {
              fromOrder: true,
              orderId: data.orderId,
              orderNumber: data.orderNumber,
              type: data.type,
              customerName: data.customerName,
              customerId: data.customerId,
              componentName: component.name,
            },
          };

          product = await this.create(productData);
          this.logger.log(`📦 Nuevo producto creado: ${product.code}`);
          
          // ✅ Sincronizar con syncProduct normal (crea InventoryFlow si no existe)
          // ✅ También pasamos los IMEIS aquí
          const syncDataNormal = {
            ...data,
            imeis: data.imeis || [],
            orderPublicId: data.public_id || null,
          };
          await this.incomeBackendService.syncProductNormal(product, syncDataNormal, component);
        }
        
        results.push({
          component: component.name,
          productId: product._id,
          code: product.code,
          sku: product.sku,
          upc: product.upc,
        });
      }

      return {
        success: true,
        message: `${results.length} producto(s) creados desde orden ${data.orderNumber}`,
        products: results,
        count: results.length,
        orderId: data.orderId,
        orderNumber: data.orderNumber,
      };

    } catch (error) {
      this.logger.error('❌ Error en createFromOrder:', error);
      throw error;
    }
  }

  // ============================================
  // ✅ NUEVOS MÉTODOS
  // ============================================

  async findByDeviceId(deviceId: number): Promise<ProductDocument[]> {
    return this.productModel.find({
      deviceId,
      isDeleted: false
    }).exec();
  }

  async findByOrderId(orderId: string): Promise<ProductDocument[]> {
    const orderIdNumber = parseInt(orderId, 10);
    
    this.logger.log(`🔍 Buscando productos por orderId: ${orderId} (como número: ${orderIdNumber})`);
    
    const products = await this.productModel.find({
      'metadata.orderId': orderIdNumber,
      isDeleted: false
    }).exec();
    
    // ✅ LOG PARA VER QUÉ DEVUELVE
    this.logger.log(`📦 Productos encontrados: ${products.length}`);
    this.logger.log(`📦 Datos: ${JSON.stringify(products.map(p => ({
      id: p._id,
      name: p.name,
      orderId: p.metadata?.orderId,
      orderNumber: p.metadata?.orderNumber,
      lastOrderId: p.metadata?.lastOrderId,
      lastOrderNumber: p.metadata?.lastOrderNumber,
      sku: p.sku
    })), null, 2)}`);
    
    return products;
  }

  async updateSku(productId: string, newSku: string): Promise<ProductDocument> {
    try {
      const product = await this.findOne(productId);
      if (!product) {
        throw new NotFoundException(`Producto con ID ${productId} no encontrado`);
      }
      
      this.logger.log(`🔄 Actualizando SKU de ${product.sku} a ${newSku}`);
      product.sku = newSku;
      product.updatedAt = new Date();
      
      return await product.save();
    } catch (error: any) {
      this.logger.error(`❌ Error updateSku: ${error.message}`);
      throw error;
    }
  }

  async updateUpc(productId: string, newUpc: string): Promise<ProductDocument> {
    try {
      const product = await this.findOne(productId);
      if (!product) {
        throw new NotFoundException(`Producto con ID ${productId} no encontrado`);
      }
      
      this.logger.log(`🔄 Actualizando UPC de ${product.upc} a ${newUpc}`);
      product.upc = newUpc;
      product.updatedAt = new Date();
      
      return await product.save();
    } catch (error: any) {
      this.logger.error(`❌ Error updateUpc: ${error.message}`);
      throw error;
    }
  }

  // ============================================
  // ✅ INVENTORY FLOW - BÚSQUEDA Y CREACIÓN
  // ============================================

  async searchInventoryFlowItems(query: any): Promise<any> {
    try {
      const searchTerm = query.q || '';
      const limit = parseInt(query.limit) || 20;
      const page = parseInt(query.page) || 1;
      const skip = (page - 1) * limit;

      const filter: any = { isDeleted: false };

      if (searchTerm) {
        filter.$or = [
          { name: { $regex: searchTerm, $options: 'i' } },
          { brand: { $regex: searchTerm, $options: 'i' } },
          { model: { $regex: searchTerm, $options: 'i' } },
          { code: { $regex: searchTerm, $options: 'i' } },
          { sku: { $regex: searchTerm, $options: 'i' } },
        ];
      }

      if (query.brand) {
        filter.brand = { $regex: query.brand, $options: 'i' };
      }
      if (query.type) {
        filter.type = query.type;
      }
      if (query.condition) {
        filter.condition = query.condition;
      }

      const [items, total] = await Promise.all([
        this.productModel.find(filter)
          .sort({ name: 1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.productModel.countDocuments(filter),
      ]);

      return {
        success: true,
        data: items.map(item => ({
          _id: item._id,
          code: item.code,
          sku: item.sku,
          name: item.name,
          brand: item.brand,
          model: item.model,
          type: item.type,
          color: item.color,
          quality: item.quality,
          condition: item.condition,
          purchasePrice: item.purchasePrice,
          salePrice: item.salePrice,
          stockQuantity: item.stockQuantity,
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      this.logger.error(`❌ Error buscando ítems: ${error.message}`);
      throw error;
    }
  }

  async getInventoryFlowById(id: string): Promise<any> {
    const item = await this.productModel.findOne({
      _id: id,
      isDeleted: false,
    }).lean().exec();

    if (!item) {
      throw new NotFoundException(`Inventory flow con ID ${id} no encontrado`);
    }

    return {
      _id: item._id,
      code: item.code,
      sku: item.sku,
      name: item.name,
      brand: item.brand,
      model: item.model,
      type: item.type,
      color: item.color,
      quality: item.quality,
      condition: item.condition,
      purchasePrice: item.purchasePrice,
      salePrice: item.salePrice,
      stockQuantity: item.stockQuantity,
    };
  }

  /**
   * Crear producto desde inventory flow existente
   */
  async createProductFromInventoryFlow(payload: any): Promise<any> {
    try {
      this.logger.log(`📦 Creando producto desde inventory flow: ${payload.inventoryFlowId}`);

      const inventoryFlow = await this.incomeBackendService.getInventoryFlowById(payload.inventoryFlowId);
      
      if (!inventoryFlow) {
        throw new Error(`Inventory flow con ID ${payload.inventoryFlowId} no encontrado`);
      }

      this.logger.log(`📦 Inventory flow encontrado: ${inventoryFlow.sku} - ${inventoryFlow.name_nameitems}`);

      const component = {
        name: payload.name || inventoryFlow.name_nameitems || 'Producto',
        brand: payload.brand || inventoryFlow.brand || 'Genérico',
        model: payload.model || inventoryFlow.name_model || 'Dispositivo',
        type: payload.type || inventoryFlow.type || 'PARTE',
        color: payload.color || inventoryFlow.name_color || 'No especificado',
        quality: payload.quality || inventoryFlow.name_quality || 'B',
        condition: payload.condition || inventoryFlow.condition || 'NUEVO',
        description: payload.observations || `Ingreso desde inventory flow ${inventoryFlow.sku}`,
        quantity: payload.quantity || 1,
        purchasePrice: payload.purchasePrice || inventoryFlow.purchasePrice || 0,
        salePrice: payload.salePrice || inventoryFlow.salePrice || 0,
        sku: inventoryFlow.sku,
        upc: inventoryFlow.upc || '',
      };

      const orderData = {
        orderId: payload.orderId || Date.now(),
        orderNumber: payload.orderNumber || `IF-${Date.now()}`,
        deviceId: payload.deviceId || inventoryFlow.device_id_numero,
        deviceName: payload.deviceName || inventoryFlow.name_model || inventoryFlow.name_nameitems,
        deviceColor: payload.deviceColor || inventoryFlow.name_color,
        customerName: payload.customerName,
        customerId: payload.customerId,
        type: payload.type || 'PARTE',
        components: [component],
        observations: payload.observations,
        createdById: payload.createdById,
        createdByName: payload.createdByName,
        fromInventoryFlow: true,
        inventoryFlowId: inventoryFlow._id,
        sku: inventoryFlow.sku,
        upc: inventoryFlow.upc || '',
        imeis: payload.imeis || [],
        porcentaje: payload.porcentaje || '65ae74b9f978d87a5c41fd2a',
        tipo_documento: payload.tipo_documento || '65ae74b9f978d87a5c41fd2a',
        inventory_id: payload.inventory_id || new Types.ObjectId('67b3bc26b850b543c94ca47d'),
        inventory_name: payload.inventory_name || 'INVENTORYFLOW',
      };

      const result = await this.createFromOrder(orderData);

      return {
        success: true,
        data: {
          product: result.products[0],
          inventoryFlow: {
            _id: inventoryFlow._id,
            sku: inventoryFlow.sku,
            name: inventoryFlow.name_nameitems,
          },
        },
        message: `Producto creado y enlazado con inventory flow ${inventoryFlow.sku}`,
      };

    } catch (error: any) {
      this.logger.error(`❌ Error creando producto desde inventory flow: ${error.message}`);
      throw {
        statusCode: 500,
        message: error.message || 'Error al crear producto desde inventory flow',
      };
    }
  }
}