import { Body, Controller, Post, Get, Query, ParseIntPipe, Param, DefaultValuePipe, Patch } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { User } from '../common/auth/decorators/user.decorator';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { GetOrdersFilterDto } from './dto/get-orders-filter.dto.gateway';
import { GetAdminDashboardRangeDto } from './dto/get-admin-dashboard.dto.gateway';
import { Groups } from '../common/auth/decorators/groups.decorator';
import { RegisterOrderPrintDto } from './dto/register-order-print.dto.gateway';
import { GetPrintStatusDto } from './dto/get-print-status.dto.gateway';
import { RegisterPrintCopyDto } from './dto/register-print-copy.dto.gateway';
import { UpdateFineStatusDto } from './dto/update-fine-status.dto';
import { GetEmployeesFinesDto } from './dto/get-employees-fines.dto';
import { GetFinesListDto } from './dto/get-fines-list.dto';
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
    return this.reportsService.getDashboard(user);
  }

  @Get('dashboard-drill')
  async getDashboardDrill(
    @Query('card') card: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @User() user: any,
  ) {
    return this.reportsService.getDashboardDrill(user, card, page, limit);
  }

  @Patch('validations/:id')
  @Groups('ORDER_AUDIT')
  async toggleValidation(
    @Param('id') id: string,
    @Body('is_checked') isChecked: boolean,
    @User() user: any,
  ) {
    return this.reportsService.toggleOrderValidation(id, isChecked, user);
  }
  @Get('validation-status/:id')
  @Groups('ORDER_AUDIT')
  async getValidationStatus(
    @Param('id') id: string,
  ) {

    return this.reportsService.getValidationStatus(id);
  }

  @Get('admin-dashboard')
  async getAdminDashboardRange(
    @Query() dto: GetAdminDashboardRangeDto,
    @User() user: any,
  ) {
    return this.reportsService.getAdminDashboardRange(user, dto);
  }

  @Post('print')
  async registerOrderPrint(
    @Body() dto: RegisterOrderPrintDto,
    @User() user: any,
  ) {
    return this.reportsService.registerOrderPrint(user, dto);
  }
  @Get('print-status')
  async getPrintStatus(
    @Query() dto: GetPrintStatusDto,
  ) {
    return this.reportsService.getPrintStatus(dto);
  }
  @Post('print-copy')
  async registerPrintCopy(
    @Body() dto: RegisterPrintCopyDto,
    @User() user: any,
  ) {
    return this.reportsService.registerPrintCopy(user, dto);
  }
  @Get('employees-summary')
  async getEmployeesFinesSummary(@Query() dto: GetEmployeesFinesDto, @User() user: any,) {
    return this.reportsService.getEmployeesFinesSummary(user, dto);
  }

  @Patch(':fineId/status')
  async updateFineStatus(
    @Param('fineId') fineId: string,
    @Body() dto: Omit<UpdateFineStatusDto, 'fineId'>,
    @User() user: any,
  ) {
    return this.reportsService.updateFineStatus(user, { ...dto, fineId });
  }
  // reports.controller.ts (agregar en tu ReportsController)
  @Get('fines')
  async getFinesList(@Query() dto: GetFinesListDto, @User() user: any) {
    return this.reportsService.getFinesList(user, dto);
  }

  @Get('fines/employees-filter')
  async getEmployeesForFilter(@User() user: any) {
    return this.reportsService.getEmployeesForFilter(user);
  }
  @Get('fines/:fineId')
  async getFineDetail(@Param('fineId') fineId: string, @User() user: any) {
    return this.reportsService.getFineDetail(user, fineId);
  }
}