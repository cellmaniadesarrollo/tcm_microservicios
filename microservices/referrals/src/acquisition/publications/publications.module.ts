import { Module } from '@nestjs/common';
import { PublicationsService } from './publications.service';
import { PublicationsController } from './publications.controller';

@Module({
  providers: [PublicationsService],
  controllers: [PublicationsController]
})
export class PublicationsModule {}
