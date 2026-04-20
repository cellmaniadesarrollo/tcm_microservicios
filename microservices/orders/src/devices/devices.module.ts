import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from './entities/device.entity';
import { DeviceAccount } from './entities/device_account.entity';
import { DeviceIMEI } from './entities/device_imei.entity';
import { FindingProcedure } from '../order-findings/entities/finding-procedure.entity';
import { Attachment } from '../order-findings/entities/attachment.entity';
import { AwsS3Module } from '../aws-s3/aws-s3.module';

@Module({
  imports: [TypeOrmModule.forFeature([Device, DeviceAccount, DeviceIMEI, FindingProcedure, Attachment]), AwsS3Module],
  controllers: [DevicesController],
  providers: [DevicesService],
})
export class DevicesModule { }
