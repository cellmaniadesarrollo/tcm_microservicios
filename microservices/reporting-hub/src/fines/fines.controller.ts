import { Controller } from '@nestjs/common';
import { FinesService } from './fines.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { GetEmployeesFinesDto } from './dto/get-employees-fines.dto';
import { UpdateFineStatusDto } from './dto/update-fine-status.dto';
import { GetFinesListDto } from './dto/get-fines-list.dto';

@Controller('fines')
export class FinesController {
  constructor(
    private readonly finesService: FinesService,
  ) { }

  @MessagePattern({ cmd: 'get_employees_fines_summary' })
  async getEmployeesFinesSummary(@Payload() payload: any) {
    const { data, user } = payload;

    return this.finesService.getEmployeesFinesSummary({
      companyId: user.companyId, // 👈 viene de user, no de data/dto
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      status: data.status,
      page: data.page,
      limit: data.limit,
    });
  }
  @MessagePattern({ cmd: 'update_fine_status' })
  async updateFineStatus(@Payload() payload: any) {
    const { data, user } = payload;

    return this.finesService.updateFineStatus(user, data as UpdateFineStatusDto);
  }
  // fines/fines.controller.ts (agregar patterns)
  @MessagePattern({ cmd: 'get_fines_list' })
  async getFinesList(@Payload() payload: any) {
    const { data, user } = payload;
    return this.finesService.getFinesList(user.companyId, data as GetFinesListDto);
  }

  @MessagePattern({ cmd: 'get_employees_for_filter' })
  async getEmployeesForFilter(@Payload() payload: any) {
    const { user } = payload;
    return this.finesService.getEmployeesForFilter(user.companyId);
  }
  @MessagePattern({ cmd: 'get_fine_detail' })
  async getFineDetail(@Payload() payload: any) {
    const { data, user } = payload;
    return this.finesService.getFineDetail(user.companyId, data.fineId);
  }
}
