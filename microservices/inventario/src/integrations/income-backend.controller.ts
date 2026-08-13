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
  // ✅ POST /inventory/save - Guardar inventario desde orden
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

  // ============================================
  // ✅ POST /incomes/save - Guardar income directamente
  // ============================================
  @Post('incomes/save')
  @ApiOperation({ summary: 'Guardar un ingreso (income)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Income guardado exitosamente' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Datos inválidos' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Error interno' })
  async saveIncome(@Body() payload: any) {
    this.logger.log(`📤 POST /incomes/save - Item: ${payload.id_item || 'N/A'}`);
    return this.incomeBackendService.saveIncome(payload);
  }

  // ============================================
  // ✅ POST /sync/product - Sincronizar producto
  // ============================================
  @Post('sync/product')
  @ApiOperation({ summary: 'Sincronizar producto con incomes' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Producto sincronizado' })
  async syncProduct(@Body() payload: any) {
    this.logger.log(`📤 POST /sync/product - Product: ${payload.product?.name || 'N/A'}`);
    return this.incomeBackendService.syncProduct(
      payload.product,
      payload.orderData,
      payload.component
    );
  }

  // ============================================
  // ✅ GET /incomes/:id - Obtener income por ID
  // ============================================
  @Get('incomes/:id')
  @ApiOperation({ summary: 'Obtener un income por ID' })
  @ApiParam({ name: 'id', description: 'ID del income' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Income encontrado' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Income no encontrado' })
  async getIncomeById(@Param('id') id: string) {
    this.logger.log(`📤 GET /incomes/${id}`);
    return this.incomeBackendService.getIncomeById(id);
  }

  // ============================================
  // ✅ GET /incomes/by-order/:orderId - Obtener incomes por orden
  // ============================================
  @Get('incomes/by-order/:orderId')
  @ApiOperation({ summary: 'Obtener incomes por ID de orden' })
  @ApiParam({ name: 'orderId', description: 'ID de la orden' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Incomes encontrados' })
  async getIncomesByOrderId(@Param('orderId') orderId: string) {
    this.logger.log(`📤 GET /incomes/by-order/${orderId}`);
    return this.incomeBackendService.getIncomesByOrderId(orderId);
  }

  // ============================================
  // ✅ GET /incomes/by-item/:itemId - Obtener incomes por item
  // ============================================
  @Get('incomes/by-item/:itemId')
  @ApiOperation({ summary: 'Obtener incomes por ID de item' })
  @ApiParam({ name: 'itemId', description: 'ID del item' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Incomes encontrados' })
  async getIncomesByItemId(@Param('itemId') itemId: string) {
    this.logger.log(`📤 GET /incomes/by-item/${itemId}`);
    return this.incomeBackendService.getIncomesByItemId(itemId);
  }

  // ============================================
  // ✅ GET /incomes/list - Listar incomes con paginación
  // ============================================
  @Get('incomes/list')
  @ApiOperation({ summary: 'Listar incomes con paginación' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Página' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Límite por página' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Búsqueda' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista de incomes' })
  async listIncomes(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string
  ) {
    this.logger.log(`📤 GET /incomes/list - page: ${page}, limit: ${limit}, search: ${search}`);
    return this.incomeBackendService.listIncomes(page, limit, search);
  }

  // ============================================
  // ✅ GET /batches/by-income/:incomeId - Obtener batch por income
  // ============================================
  @Get('batches/by-income/:incomeId')
  @ApiOperation({ summary: 'Obtener batch por ID de income' })
  @ApiParam({ name: 'incomeId', description: 'ID del income' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Batch encontrado' })
  async getBatchByIncomeId(@Param('incomeId') incomeId: string) {
    this.logger.log(`📤 GET /batches/by-income/${incomeId}`);
    return this.incomeBackendService.getBatchByIncomeId(incomeId);
  }

  // ============================================
  // ✅ GET /batches/:id - Obtener batch por ID
  // ============================================
  @Get('batches/:id')
  @ApiOperation({ summary: 'Obtener un batch por ID' })
  @ApiParam({ name: 'id', description: 'ID del batch' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Batch encontrado' })
  async getBatchById(@Param('id') id: string) {
    this.logger.log(`📤 GET /batches/${id}`);
    return this.incomeBackendService.getBatchById(id);
  }

  // ============================================
  // ✅ GET /stock/by-batch/:batchId - Obtener stock por batch
  // ============================================
  @Get('stock/by-batch/:batchId')
  @ApiOperation({ summary: 'Obtener stock por ID de batch' })
  @ApiParam({ name: 'batchId', description: 'ID del batch' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Stock encontrado' })
  async getStockByBatchId(@Param('batchId') batchId: string) {
    this.logger.log(`📤 GET /stock/by-batch/${batchId}`);
    return this.incomeBackendService.getStockByBatchId(batchId);
  }

  // ============================================
  // ✅ GET /inventory-flows/:id - Obtener inventory flow
  // ============================================
  @Get('inventory-flows/:id')
  @ApiOperation({ summary: 'Obtener inventory flow por ID' })
  @ApiParam({ name: 'id', description: 'ID del inventory flow' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Inventory flow encontrado' })
  async getInventoryFlowById(@Param('id') id: string) {
    this.logger.log(`📤 GET /inventory-flows/${id}`);
    return this.incomeBackendService.getInventoryFlowById(id);
  }

  // ============================================
  // ✅ GET /inventory-flows/by-sku/:sku - Obtener inventory flow por SKU
  // ============================================
  @Get('inventory-flows/by-sku/:sku')
  @ApiOperation({ summary: 'Obtener inventory flow por SKU' })
  @ApiParam({ name: 'sku', description: 'SKU del producto' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Inventory flow encontrado' })
  async getInventoryFlowBySku(@Param('sku') sku: string) {
    this.logger.log(`📤 GET /inventory-flows/by-sku/${sku}`);
    return this.incomeBackendService.getInventoryFlowBySku(sku);
  }
}