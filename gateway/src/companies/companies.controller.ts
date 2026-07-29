import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CreateCompanyDto } from './dto/create-company.dto';

@Controller('companies')
export class CompaniesController {
  constructor(
    @Inject('COMPANIES_SERVICE')
    private readonly companiesClient: ClientProxy,
  ) {}

  @Post('save')
  async create(@Body() dto: CreateCompanyDto) {
    console.log(dto)
    return firstValueFrom(
      this.companiesClient.send(
        { cmd: 'save_one_companies' },        {
          internalToken: process.env.INTERNAL_SECRET,
          dto,
        }, // 🔥 sin internalToken
      ),
    );
  }
}
