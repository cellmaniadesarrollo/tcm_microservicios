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
import { Model } from 'mongoose';
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

  /**
   * Obtiene las primeras 3 letras de un string, limpiándolo primero
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

  // ✅ CREAR PRODUCTO - SIN GENERAR SKU (se genera en IncomeBackendService)
  async create(createProductDto: CreateProductDto): Promise<ProductDocument> {
    // Verificar duplicados
    const existing = await this.productModel.findOne({
      name: createProductDto.name,
      brand: createProductDto.brand,
      model: createProductDto.model,
      color: createProductDto.color,
      isDeleted: false,
    });

    if (existing) {
      throw new ConflictException('Ya existe un producto con estas características');
    }

    const code = createProductDto.code || (await this.generateProductCode());

    // ❌ NO GENERAR SKU Y UPC AQUÍ
    // El SKU y UPC se generarán en IncomeBackendService.syncProduct()

    // ✅ USAR EL VALOR DE QUALITY DIRECTAMENTE (sin mapeo)
    const quality = createProductDto.quality || 'B';

    const product = new this.productModel({
      ...createProductDto,
      code,
      quality, // ✅ Guardar el valor tal cual
      // ❌ NO INCLUIR sku
      // ❌ NO INCLUIR upc
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

  // ============================================
  // ACTUALIZAR DESDE EVENTO DE ORDEN (KAFKA)
  // ============================================
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
  // ✅ CREATE FROM ORDER - SIN GENERAR SKU
  // ============================================
  async createFromOrder(data: any): Promise<any> {
    try {
      this.logger.log(`📦 Procesando orden ${data.orderNumber} - Tipo: ${data.type}`);
      
      const results = [];
      
      for (const component of data.components) {
        // ❌ NO GENERAR SKU Y UPC AQUÍ
        
        // ✅ USAR EL VALOR DE QUALITY DIRECTAMENTE
        const quality = component.quality || 'B';
        
        const productData: CreateProductDto = {
          name: component.name,
          brand: component.brand || data.deviceName?.split(' ')[0] || 'Genérico',
          model: component.model || data.deviceName || 'Dispositivo',
          type: component.type || (data.type === 'COMPLETO' ? 'DISPOSITIVO' : 'PARTE'),
          color: component.color || data.deviceColor || 'No especificado',
          quality: quality, // ✅ Guardar el valor tal cual
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
          // ❌ NO INCLUIR sku
          // ❌ NO INCLUIR upc
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

        const product = await this.create(productData);
        
        this.logger.log(`📤 [createFromOrder] Producto creado: ${product.code}, llamando a syncProduct...`);
        
        // ✅ syncProduct generará el SKU y UPC
        await this.incomeBackendService.syncProduct(product, data, component);
        
        this.logger.log(`✅ [createFromOrder] syncProduct completado para ${product.code} - SKU: ${product.sku} - UPC: ${product.upc}`);
        
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
    
    return this.productModel.find({
      'metadata.orderId': orderIdNumber,
      isDeleted: false
    }).exec();
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
}