import { Controller } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { MessagePattern } from '@nestjs/microservices';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}


@MessagePattern({ cmd: 'create_device' })
async createDevice(data: any) {
  return this.devicesService.createDevice(data);
}
@MessagePattern({ cmd: 'search_imei' })
async searchIMEI(data: any) {
  return this.devicesService.searchByIMEIOrSerial(data.imei,data.user);
}
@MessagePattern({ cmd: 'get_device_by_id' })
async getDeviceById(data: any) {
  return this.devicesService.findOneById(
    data.deviceId,
    data.user,
  );
}
@MessagePattern({ cmd: 'update_device' })
async updateDevice(data: {
  deviceId: number;
  dto: UpdateDeviceDto;
  user: { companyId: string };
}) {
  return this.devicesService.updateDevice(
    data.deviceId,
    data.user,
    data.dto,
  );
}
}
