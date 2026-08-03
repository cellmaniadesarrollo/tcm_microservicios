import { Controller } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) { }

  @MessagePattern({ cmd: 'save_one_companies' })
  async createCompany(@Payload() data: any) {
   // console.log(data)
    return this.companiesService.createCompanyWithMainBranch(data.dto);
  }
  @MessagePattern({ cmd: 'async_companies_start' })
  async onSyncStart(@Payload() payload: any) {
    console.log('🔄 Solicitud de sincronización companias recibida', payload);

    const data = await this.companiesService.findFullDataByCreatedAfter(payload.fromCache);

    return data; 
  }
}
