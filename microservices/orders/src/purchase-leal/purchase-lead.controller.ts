import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Headers,
} from '@nestjs/common';
import { PurchaseLeadService } from './purchase-lead.service';
import { CreatePurchaseLeadDto } from './dto/create-purchase-leal.dto';
import { ListPurchaseLeadsDto } from './dto/list-purchase-leads.dto';
import { MarkContactedDto } from './dto/mark-contacted.dto';

@Controller('purchase-leads')
export class PurchaseLeadController {
  constructor(private readonly service: PurchaseLeadService) {}

  /**
   * POST /purchase-leads
   * Registrar un nuevo lead de posible compra
   */
  @Post()
  create(
    @Body() dto: CreatePurchaseLeadDto,
    @Headers('x-user-id') userId: string, // viene del interceptor de auth interno
  ) {
    return this.service.create(dto, userId);
  }

  /**
   * GET /purchase-leads
   * Listar leads con filtros opcionales
   */
  @Get()
  findAll(@Query() filters: ListPurchaseLeadsDto) {
    return this.service.findAll(filters);
  }

  /**
   * GET /purchase-leads/:id
   * Obtener un lead específico
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  /**
   * PATCH /purchase-leads/:id/contact
   * Marcar que ya se contactó al cliente
   */
  @Patch(':id/contact')
  markContacted(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MarkContactedDto,
  ) {
    return this.service.markContacted(id, dto);
  }

  /**
   * PATCH /purchase-leads/:id/close
   * Marcar que la compra se concretó
   */
  @Patch(':id/close')
  markClosed(@Param('id', ParseIntPipe) id: number) {
    return this.service.markClosed(id);
  }

  /**
   * DELETE /purchase-leads/:id
   */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}