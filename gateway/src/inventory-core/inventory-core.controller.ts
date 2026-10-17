import {
  BadRequestException, Controller, Delete, Get, Param, ParseIntPipe,
  ParseUUIDPipe, Patch, Post, Put, Query, Req, Body,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FastifyRequest } from 'fastify';
import { InventoryCoreService } from './inventory-core.service';
import { User } from '../common/auth/decorators/user.decorator';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { CreateProductGatewayDto } from './dto/create-product-gateway.dto';
import { ReorderProductImagesDto } from './dto/reorder-product-images.dto';
import { parseAndProcessMultipart } from '../common/helpers/multipart-request.helper';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB por imagen ya convertida a WebP

@Controller('inventory-core')
@Auth()
export class InventoryCoreController {
  constructor(private readonly inventoryCoreService: InventoryCoreService) { }

  private ctx(user: any) {
    return { userId: user.sub, companyId: user.companyId, branchId: user.branchId };
  }

  @Get('new-data')
  async getNewData(@User() user: any) {
    return this.inventoryCoreService.getPartRequestFormOptions(this.ctx(user));
  }

  // ───────────── Productos ─────────────

  @Post('products')
  async createProduct(@Req() request: FastifyRequest, @User() user: any) {
    const { formData, files } = await parseAndProcessMultipart(request, 5 * 1024 * 1024);
    const dto = await this.buildProductDto(formData);
    return this.inventoryCoreService.createProduct(dto, files, this.ctx(user));
  }

  private async buildProductDto(formData: Record<string, string>): Promise<CreateProductGatewayDto> {
    // Campos vacíos de un formulario = no enviados
    const raw: Record<string, any> = Object.fromEntries(
      Object.entries(formData).filter(([, v]) => v !== '' && v != null),
    );

    // Booleanos: "false" no debe convertirse en true
    for (const key of ['hasTax', 'billableInRepairOrders', 'isSellable', 'isRepairPart', 'isCustomizable']) {
      if (raw[key] !== undefined) raw[key] = raw[key] === 'true' || raw[key] === '1';
    }

    // modelIds: JSON "[1,2]" o "1,2"
    if (raw.modelIds !== undefined) {
      try {
        raw.modelIds = JSON.parse(raw.modelIds);
      } catch {
        raw.modelIds = String(raw.modelIds).split(',').map((s) => s.trim());
      }
    }

    const dto = plainToInstance(CreateProductGatewayDto, raw);
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) {
      throw new BadRequestException(errors.flatMap((e) => Object.values(e.constraints ?? {})));
    }
    return dto;
  }

  @Get('models')
  async getModels(
    @Query('brandId', ParseIntPipe) brandId: number,
    @Query('search') search?: string,
  ) {
    return this.inventoryCoreService.findModelsByBrand(brandId, search || undefined);
  }

  // ───────────── Imágenes de producto ─────────────

  @Get('products/:productId/images')
  listProductImages(
    @Param('productId', ParseUUIDPipe) productId: string,
    @User() user: any,
  ) {
    return this.inventoryCoreService.listProductImages(productId, this.ctx(user));
  }

  @Post('products/:productId/images')
  async uploadProductImages(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Req() request: FastifyRequest,
    @User() user: any,
  ) {
    const { files } = await parseAndProcessMultipart(request, MAX_IMAGE_SIZE);
    return this.inventoryCoreService.addProductImages(productId, files, this.ctx(user));
  }

  @Patch('products/:productId/images/:imageId/primary')
  setPrimaryProductImage(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @User() user: any,
  ) {
    return this.inventoryCoreService.setPrimaryProductImage(productId, imageId, this.ctx(user));
  }

  @Put('products/:productId/images/order')
  reorderProductImages(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: ReorderProductImagesDto,
    @User() user: any,
  ) {
    return this.inventoryCoreService.reorderProductImages(productId, dto.imageIds, this.ctx(user));
  }

  @Delete('products/:productId/images/:imageId')
  removeProductImage(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @User() user: any,
  ) {
    return this.inventoryCoreService.removeProductImage(productId, imageId, this.ctx(user));
  }


}