import { Body, Controller, Post, Get, Query, ParseIntPipe, Param } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { User } from '../common/auth/decorators/user.decorator';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { GetOrdersFilterDto } from './dto/get-orders-filter.dto.gateway';
// Importa tu DTO correctamente
// import { FindCustomerDto } from './dto/find-customer.dto'; 

@Controller('reports')
@Auth()
export class ReportsController {

  constructor(private readonly reportsService: ReportsService) { }

  @Get('filters')
  async getFilters(@User() user: any) {
    return this.reportsService.getOrderFilters(user);
  }

  @Get('report-list')
  async getOrdersList(
    @Query() filterDto: GetOrdersFilterDto,
    @User() user: any
  ) {
    console.log('dad', filterDto)
    return await this.reportsService.getOrdersList(user, filterDto);
  }
  @Get('report-detail/:id')
  async getOrderDetail(
    @Param('id', ParseIntPipe) id: number,
    @User() user: any,
  ) {
    console.log(user)
    return this.reportsService.getOrderDetail(user, id);
  }
  @Get('dashboard')
  async getDashboard(@User() user: any) {
    return this.reportsService.getDashboardCustomer(user);
  }

}