// gateway/src/inventario/inventario.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InventarioService } from './inventario.service';
import { CreateProductGatewayDto } from './dto/create-product-gateway.dto';
import { UpdateProductGatewayDto } from './dto/update-product-gateway.dto';
import { InventoryMovementGatewayDto } from './dto/inventory-movement-gateway.dto';

@ApiTags('inventario')
@Controller('api/inventario')
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) {}

  // ============================================
  // ✅ PRODUCTOS
  // ============================================

  @Post('products')
  @ApiOperation({ summary: 'Crear un producto' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async createProduct(@Body() data: CreateProductGatewayDto) {
    return this.inventarioService.createProduct(data);
  }
 
  @Get('products')
  @ApiOperation({ summary: 'Obtener todos los productos' })
  @ApiResponse({ status: HttpStatus.OK })
  async getProducts(@Query() filters: any) {
    return this.inventarioService.getProducts(filters);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Obtener producto por ID' })
  @ApiResponse({ status: HttpStatus.OK })
  async getProductById(@Param('id') id: string) {
    return this.inventarioService.getProductById(id);
  }

  @Get('products/code/:code')
  @ApiOperation({ summary: 'Obtener producto por código' })
  @ApiResponse({ status: HttpStatus.OK })
  async getProductByCode(@Param('code') code: string) {
    return this.inventarioService.getProductByCode(code);
  }

  @Put('products/:id')
  @ApiOperation({ summary: 'Actualizar producto' })
  @ApiResponse({ status: HttpStatus.OK })
  async updateProduct(
    @Param('id') id: string,
    @Body() data: UpdateProductGatewayDto,
  ) {
    return this.inventarioService.updateProduct(id, data);
  }

  @Patch('products/:id/inventory')
  @ApiOperation({ summary: 'Movimiento de inventario' })
  @ApiResponse({ status: HttpStatus.OK })
  async inventoryMovement(
    @Param('id') id: string,
    @Body() data: InventoryMovementGatewayDto,
  ) {
    return this.inventarioService.inventoryMovement(id, data);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Eliminar producto (soft delete)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProduct(@Param('id') id: string) {
    return this.inventarioService.deleteProduct(id);
  }

  @Patch('products/:id/restore')
  @ApiOperation({ summary: 'Restaurar producto' })
  @ApiResponse({ status: HttpStatus.OK })
  async restoreProduct(@Param('id') id: string) {
    return this.inventarioService.restoreProduct(id);
  }

  @Get('products/stats')
  @ApiOperation({ summary: 'Estadísticas de productos' })
  @ApiResponse({ status: HttpStatus.OK })
  async getStats() {
    return this.inventarioService.getStats();
  }

  @Get('products/low-stock')
  @ApiOperation({ summary: 'Productos con stock bajo' })
  @ApiResponse({ status: HttpStatus.OK })
  async getLowStock() {
    return this.inventarioService.getLowStock();
  }

  @Get('products/device/:deviceId')
  @ApiOperation({ summary: 'Obtener productos por ID de dispositivo' })
  @ApiResponse({ status: HttpStatus.OK })
  async getProductsByDeviceId(@Param('deviceId') deviceId: string) {
    return this.inventarioService.getProductsByDeviceId(deviceId);
  }

  // ============================================
  // ✅ CATEGORÍAS
  // ============================================

  @Post('categories')
  @ApiOperation({ summary: 'Crear categoría' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async createCategory(@Body() data: any) {
    return this.inventarioService.createCategory(data);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Obtener categorías' })
  @ApiResponse({ status: HttpStatus.OK })
  async getCategories(@Query() filters: any) {
    return this.inventarioService.getCategories(filters);
  }

  @Get('categories/:id')
  @ApiOperation({ summary: 'Obtener categoría por ID' })
  @ApiResponse({ status: HttpStatus.OK })
  async getCategoryById(@Param('id') id: string) {
    return this.inventarioService.getCategoryById(id);
  }

  @Put('categories/:id')
  @ApiOperation({ summary: 'Actualizar categoría' })
  @ApiResponse({ status: HttpStatus.OK })
  async updateCategory(@Param('id') id: string, @Body() data: any) {
    return this.inventarioService.updateCategory(id, data);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Eliminar categoría' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(@Param('id') id: string) {
    return this.inventarioService.deleteCategory(id);
  }

  // ============================================
  // ✅ MOVIMIENTOS
  // ============================================

  @Get('movements/product/:productId')
  @ApiOperation({ summary: 'Movimientos de un producto' })
  @ApiResponse({ status: HttpStatus.OK })
  async getMovementsByProduct(@Param('productId') productId: string) {
    return this.inventarioService.getMovementsByProduct(productId);
  }

  @Get('movements/order/:orderId')
  @ApiOperation({ summary: 'Movimientos de una orden' })
  @ApiResponse({ status: HttpStatus.OK })
  async getMovementsByOrder(@Param('orderId') orderId: string) {
    return this.inventarioService.getMovementsByOrder(orderId);
  }

  @Get('movements/:id')
  @ApiOperation({ summary: 'Obtener movimiento por ID' })
  @ApiResponse({ status: HttpStatus.OK })
  async getMovementById(@Param('id') id: string) {
    return this.inventarioService.getMovementById(id);
  }

  // ============================================
  // ✅ INVENTARIO DESDE ORDEN
  // ============================================

  @Post('from-order')
  @ApiOperation({ summary: 'Registrar inventario desde una orden' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async createInventoryFromOrder(@Body() data: any) {
    return this.inventarioService.createInventoryFromOrder(data);
  }

  @Get('by-order/:orderId')
  @ApiOperation({ summary: 'Obtener inventario por ID de orden' })
  @ApiResponse({ status: HttpStatus.OK })
  async getInventoryByOrder(@Param('orderId') orderId: string) {
    return this.inventarioService.getInventoryByOrder(orderId);
  }

  // ============================================
  // ✅ NUEVOS ENDPOINTS PARA TYPES, BRANDS, COLORS Y GENERATE SKU
  // ============================================

  // ✅ GET /types - Obtener todos los tipos de inventario
  @Get('income-backend/types')
  @ApiOperation({ summary: 'Obtener todos los tipos de inventario' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista de tipos' })
  async getTypes() {
    return this.inventarioService.getTypes();
  }

  // ✅ GET /brands - Obtener todas las marcas
  @Get('income-backend/brands')
  @ApiOperation({ summary: 'Obtener todas las marcas' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista de marcas' })
  async getBrands() {
    return this.inventarioService.getBrands();
  }

  // ✅ GET /colors - Obtener todos los colores
  @Get('income-backend/colors')
  @ApiOperation({ summary: 'Obtener todos los colores' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista de colores' })
  async getColors() {
    return this.inventarioService.getColors();
  }

  @Get('income-backend/qualities')
  @ApiOperation({ summary: 'Obtener todas las calidades' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista de calidades' })
  async getQualities() {
    return this.inventarioService.getQualities();
  }

  // ✅ POST /generate-sku - Generar SKU
  @Post('income-backend/generate-sku')
  @ApiOperation({ summary: 'Generar SKU' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'SKU generado' })
  async generateSku(@Body() data: { typeId: string; brandId: string; colorId: string; inventoryName?: string }) {
    return this.inventarioService.generateSku(data);
  }

  // ============================================
  // ✅ NUEVOS ENDPOINTS PARA BODEGA (Income Backend)
  // ============================================

  @Get('income-backend/orders/warehouse')
  @ApiOperation({ summary: 'Obtener órdenes para bodega (status_id = 9)' })
  @ApiResponse({ status: HttpStatus.OK })
  async getOrdersForWarehouse() {
    return this.inventarioService.getOrdersForWarehouse();
  }

  @Get('income-backend/orders/:orderId')
  @ApiOperation({ summary: 'Obtener detalles de una orden' })
  @ApiResponse({ status: HttpStatus.OK })
  async getOrderDetails(@Param('orderId') orderId: string) {
    return this.inventarioService.getOrderDetails(orderId);
  }

  @Get('income-backend/inventory/order/:orderId')
  @ApiOperation({ summary: 'Obtener inventario existente de una orden' })
  @ApiResponse({ status: HttpStatus.OK })
  async getInventoryByOrderFromIncome(@Param('orderId') orderId: string) {
    return this.inventarioService.getInventoryByOrderFromIncome(orderId);
  }

  @Post('income-backend/inventory/save')
  @ApiOperation({ summary: 'Guardar inventario desde una orden' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async saveInventoryFromOrder(@Body() payload: any) {
    return this.inventarioService.saveInventoryFromOrder(payload);
  }

  @Get('income-backend/parts/available/:orderId')
  @ApiOperation({ summary: 'Obtener partes disponibles para una orden' })
  @ApiResponse({ status: HttpStatus.OK })
  async getAvailableParts(@Param('orderId') orderId: string) {
    return this.inventarioService.getAvailableParts(orderId);
  }
}