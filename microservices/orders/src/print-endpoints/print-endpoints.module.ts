import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrintEndpoint } from './entities/print-endpoint.entity';
import { PrintEndpointsService } from './print-endpoints.service';
import { PrintEndpointsController } from './print-endpoints.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PrintEndpoint])],
  controllers: [PrintEndpointsController],
  providers: [PrintEndpointsService],
})
export class PrintEndpointsModule {}