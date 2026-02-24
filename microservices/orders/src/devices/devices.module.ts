import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from './entities/device.entity';
import { DeviceAccount } from './entities/device_account.entity';
import { DeviceIMEI } from './entities/device_imei.entity';

@Module({
  imports:[TypeOrmModule.forFeature([Device,DeviceAccount,DeviceIMEI]) ],
  controllers: [DevicesController],
  providers: [DevicesService],
})
export class DevicesModule {}
