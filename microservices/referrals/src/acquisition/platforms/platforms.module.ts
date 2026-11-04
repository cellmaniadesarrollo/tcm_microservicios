import { Module } from '@nestjs/common';
import { PlatformsService } from './platforms.service';
import { PlatformsController } from './platforms.controller';

@Module({
  providers: [PlatformsService],
  controllers: [PlatformsController]
})
export class PlatformsModule {}
