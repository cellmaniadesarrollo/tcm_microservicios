import { Body, Controller, Get, ParseIntPipe, Post, Query } from '@nestjs/common';
import { InventoryCoreService } from './inventory-core.service';
import { User } from '../common/auth/decorators/user.decorator';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { CreateProductGatewayDto } from './dto/create-product-gateway.dto';

@Controller('inventory-core')
@Auth()
export class InventoryCoreController {
  constructor(private readonly inventoryCoreService: InventoryCoreService) { }
  @Get('new-data')
  async getNewData(@User() user: any) {
    return this.inventoryCoreService.getPartRequestFormOptions({
      userId: user.sub,
      companyId: user.companyId,
      branchId: user.branchId,
    });
  }


  @Post('products')
  async createProduct(@Body() dto: CreateProductGatewayDto, @User() user: any) {
    return this.inventoryCoreService.createProduct(dto, {
      userId: user.sub,
      companyId: user.companyId,
      branchId: user.branchId,
    });
  }


  @Get('models')
  async getModels(
    @Query('brandId', ParseIntPipe) brandId: number,
    @Query('search') search?: string,
  ) {
    return this.inventoryCoreService.findModelsByBrand(brandId, search || undefined);
  }
}
