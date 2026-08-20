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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InventoryMovementDto } from './dto/inventory-movement.dto';
import { StatusChangeDto } from './dto/status-change.dto';
import { ProductResponseDto } from './dto/product-response.dto';

@ApiTags('products')
@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ============================================
  // POST
  // ============================================

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo producto' })
  @ApiResponse({ status: HttpStatus.CREATED, type: ProductResponseDto })
  async create(@Body() createProductDto: CreateProductDto) {
    return await this.productsService.create(createProductDto);
  }

  @Post('from-order')
  @ApiOperation({ summary: 'Crear productos en inventario desde una orden' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Productos creados exitosamente' })
  async createFromOrder(@Body() data: any) {
    return await this.productsService.createFromOrder(data);
  }

  @Post('from-inventory-flow')
  @ApiOperation({ summary: 'Crear producto desde inventory flow existente' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async createProductFromInventoryFlow(@Body() payload: any) {
    return await this.productsService.createProductFromInventoryFlow(payload);
  }

  // ============================================
  // ✅ GET - RUTAS ESPECÍFICAS (SIN PARÁMETROS) - PRIMERO
  // ============================================

  @Get()
  @ApiOperation({ summary: 'Obtener todos los productos' })
  @ApiResponse({ status: HttpStatus.OK, type: [ProductResponseDto] })
  async findAll(@Query() filters: any) {
    return await this.productsService.findAll(filters);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obtener estadísticas de productos' })
  async getStats() {
    return await this.productsService.getStats();
  }

  @Get('search')
  @ApiOperation({ summary: 'Búsqueda avanzada' })
  async advancedSearch(@Query() searchParams: any) {
    return await this.productsService.advancedSearch(searchParams);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Obtener productos con stock bajo' })
  async findLowStock() {
    return await this.productsService.findLowStock();
  }

  // ✅ INVENTORY FLOW - RUTAS ESPECÍFICAS (DEBEN IR ANTES DE :id)
  @Get('search-inventory-flow')
  @ApiOperation({ summary: 'Buscar ítems en inventory flow' })
  @ApiResponse({ status: HttpStatus.OK })
  async searchInventoryFlowItems(@Query() query: any) {
    return await this.productsService.searchInventoryFlowItems(query);
  }

  @Get('inventory-flow/:id')
  @ApiOperation({ summary: 'Obtener inventory flow por ID' })
  @ApiResponse({ status: HttpStatus.OK })
  async getInventoryFlowById(@Param('id') id: string) {
    return await this.productsService.getInventoryFlowById(id);
  }

  // ============================================
  // ✅ GET - RUTAS CON PARÁMETROS ESPECÍFICOS
  // ============================================

  @Get('device/:deviceId')
  @ApiOperation({ summary: 'Obtener productos por ID de dispositivo' })
  @ApiResponse({ status: HttpStatus.OK, type: [ProductResponseDto] })
  async findByDeviceId(@Param('deviceId') deviceId: string) {
    return await this.productsService.findByDeviceId(parseInt(deviceId, 10));
  }

  @Get('by-order/:orderId')
  @ApiOperation({ summary: 'Obtener productos por ID de orden' })
  @ApiResponse({ status: HttpStatus.OK, type: [ProductResponseDto] })
  async findByOrderId(@Param('orderId') orderId: string) {
    return await this.productsService.findByOrderId(orderId);
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Obtener producto por código' })
  @ApiResponse({ status: HttpStatus.OK, type: ProductResponseDto })
  async findByCode(@Param('code') code: string) {
    return await this.productsService.findByCode(code);
  }

  // ============================================
  // ✅ GET - RUTA CON PARÁMETRO ID (AL FINAL)
  // ============================================

  @Get(':id')
  @ApiOperation({ summary: 'Obtener producto por ID' })
  @ApiResponse({ status: HttpStatus.OK, type: ProductResponseDto })
  async findOne(@Param('id') id: string) {
    return await this.productsService.findOne(id);
  }

  // ============================================
  // ✅ PUT, PATCH, DELETE
  // ============================================

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar producto' })
  @ApiResponse({ status: HttpStatus.OK, type: ProductResponseDto })
  async update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return await this.productsService.update(id, updateProductDto);
  }

  @Patch(':id/inventory')
  @ApiOperation({ summary: 'Realizar movimiento de inventario' })
  async inventoryMovement(@Param('id') id: string, @Body() movementDto: InventoryMovementDto) {
    return await this.productsService.inventoryMovement(id, movementDto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cambiar estado del producto' })
  async changeStatus(@Param('id') id: string, @Body() statusChangeDto: StatusChangeDto) {
    return await this.productsService.changeStatus(id, statusChangeDto);
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restaurar producto eliminado' })
  async restore(@Param('id') id: string) {
    return await this.productsService.restore(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar producto (soft delete)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @Body() body: any) {
    await this.productsService.softDelete(id, body.deletedById, body.deletedByName);
  }
}