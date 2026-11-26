import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceEntity } from './entities/service.entity';
import { ServiceTypeEntity } from './entities/service-type.entity';
import { ServicesCatalogController } from './controllers/services-catalog.controller';
import { ServicesCatalogService } from './services/services-catalog.service';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceTypeEntity, ServiceEntity])],
  controllers: [ServicesCatalogController],
  providers: [ServicesCatalogService],
  exports: [ServicesCatalogService],
})
export class ServicesCatalogModule {}