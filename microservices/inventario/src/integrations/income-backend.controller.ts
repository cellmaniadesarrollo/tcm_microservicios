// microservicio-inventario/src/integrations/income-backend.controller.ts

import { Controller, Post, Get, Body, Param, Query, Logger, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { IncomeBackendService } from './income-backend.service';

@ApiTags('income-backend')
@Controller('api/income-backend')
export class IncomeBackendController {
  private readonly logger = new Logger(IncomeBackendController.name);

  constructor(private readonly incomeBackendService: IncomeBackendService) {}

  // ============================================
  // ✅ POST - Guardar inventario
  // ============================================

  @Post('inventory/save')
  @ApiOperation({ summary: 'Guardar inventario desde una orden' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Inventario guardado exitosamente' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Datos inválidos' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Error interno' })
  async saveInventoryFromOrder(@Body() payload: any) {
    this.logger.log(`📤 POST /inventory/save - OrderId: ${payload.orderId || 'N/A'}`);
    return this.incomeBackendService.saveInventoryFromOrder(payload);
  }

  @Post('incomes/save')
  @ApiOperation({ summary: 'Guardar un ingreso (income)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Income guardado exitosamente' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Datos inválidos' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Error interno' })
  async saveIncome(@Body() payload: any) {
    this.logger.log(`📤 POST /incomes/save - Item: ${payload.id_item || 'N/A'}`);
    return this.incomeBackendService.saveIncome(payload);
  }

  @Post('generate-sku')
  @ApiOperation({ summary: 'Generar SKU' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'SKU generado' })
  async generateSku(@Body() data: { typeId: string; brandId: string; colorId: string; inventoryName?: string }) {
    this.logger.log(`📤 POST /generate-sku`);
    const sku = await this.incomeBackendService.generateSku(
      data.typeId,
      data.brandId,
      data.colorId,
      data.inventoryName || 'INVENTORYFLOW'
    );
    return { sku };
  }

  // ============================================
  // ✅ GET - Datos para selects y búsqueda
  // ============================================

  @Get('types')
  @ApiOperation({ summary: 'Obtener todos los tipos de inventario' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista de tipos' })
  async getTypes() {
    this.logger.log(`📤 GET /types`);
    return this.incomeBackendService.getTypes();
  }

  @Get('brands')
  @ApiOperation({ summary: 'Obtener todas las marcas' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista de marcas' })
  async getBrands() {
    this.logger.log(`📤 GET /brands`);
    return this.incomeBackendService.getBrands();
  }

  @Get('colors')
  @ApiOperation({ summary: 'Obtener todos los colores' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista de colores' })
  async getColors() {
    this.logger.log(`📤 GET /colors`);
    return this.incomeBackendService.getColors();
  }

  @Get('qualities')
  @ApiOperation({ summary: 'Obtener todas las calidades' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista de calidades' })
  async getQualities() {
    this.logger.log(`📤 GET /qualities`);
    return this.incomeBackendService.getQualities();
  }

  @Get('inventories')
  @ApiOperation({ summary: 'Obtener todos los inventarios disponibles' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista de inventarios' })
  async getInventories() {
    this.logger.log(`📤 GET /inventories`);
    return this.incomeBackendService.getInventories();
  }

  @Get('search-inventory-flow')
  @ApiOperation({ summary: 'Buscar ítems en inventory flow' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista de items encontrados' })
  async searchInventoryFlowItems(@Query() query: any) {
    this.logger.log(`📤 GET /search-inventory-flow - q: ${query.q}, inventoryId: ${query.inventoryId}`);
    return this.incomeBackendService.searchInventoryFlowItems(query);
  }

  // ============================================
  // ✅ GET - Inventory Flow por ID (para selección)
  // ============================================

  @Get('inventory-flows/:id')
  @ApiOperation({ summary: 'Obtener inventory flow por ID' })
  @ApiParam({ name: 'id', description: 'ID del inventory flow' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Inventory flow encontrado' })
  async getInventoryFlowById(@Param('id') id: string) {
    this.logger.log(`📤 GET /inventory-flows/${id}`);
    return this.incomeBackendService.getInventoryFlowById(id);
  }

  @Get('device-verification/batch/:batchId')
  @ApiOperation({ summary: 'Obtener verificación de partes por batchId' })
  @ApiParam({ name: 'batchId', description: 'ID del batch' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Verificación encontrada' })
  async getDeviceVerificationByBatchId(@Param('batchId') batchId: string) {
    this.logger.log(`📤 GET /device-verification/batch/${batchId}`);
    return this.incomeBackendService.getDeviceVerificationByBatchId(batchId);
  }

  @Get('device-verification/order/:orderId')
  @ApiOperation({ summary: 'Obtener verificaciones de partes por orderId' })
  @ApiParam({ name: 'orderId', description: 'ID de la orden' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Verificaciones encontradas' })
  async getDeviceVerificationByOrderId(@Param('orderId') orderId: string) {
    this.logger.log(`📤 GET /device-verification/order/${orderId}`);
    return this.incomeBackendService.getDeviceVerificationByOrderId(parseInt(orderId, 10));
  }
}