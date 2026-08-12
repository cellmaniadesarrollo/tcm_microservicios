import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una categoría' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async create(@Body() data: any) {
    return await this.categoriesService.create(data);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las categorías' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAll(@Query() filters: any) {
    return await this.categoriesService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener categoría por ID' })
  @ApiResponse({ status: HttpStatus.OK })
  async findOne(@Param('id') id: string) {
    return await this.categoriesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar categoría' })
  @ApiResponse({ status: HttpStatus.OK })
  async update(@Param('id') id: string, @Body() data: any) {
    return await this.categoriesService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar categoría' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    return await this.categoriesService.delete(id);
  }
}