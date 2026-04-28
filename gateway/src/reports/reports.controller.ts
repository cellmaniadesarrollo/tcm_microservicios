import { Body, Controller, Post, Get } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { User } from '../common/auth/decorators/user.decorator';
import { Auth } from '../common/auth/decorators/auth.decorator';
// Importa tu DTO correctamente
// import { FindCustomerDto } from './dto/find-customer.dto'; 

@Controller('reports')
@Auth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) { }

  @Get('dashboard')
  async findCustomer(@User() user: any) {
    // El controlador solo delega la tarea
    return this.reportsService.getDashboardCustomer(user);
  }
}