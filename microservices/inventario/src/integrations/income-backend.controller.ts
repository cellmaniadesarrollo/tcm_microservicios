// microservicio-inventario/src/integrations/income-backend.controller.ts

import { Controller, Post, Body, Logger, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Sincronizar producto' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Producto sincronizado' })
  async syncProduct(@Body() payload: any) {
    this.logger.log(`📤 POST /sync/product - Product: ${payload.product?.name || 'N/A'}`);
    return this.incomeBackendService.syncProduct(
      payload.product,
      payload.orderData,
      payload.component
    );
  }
}