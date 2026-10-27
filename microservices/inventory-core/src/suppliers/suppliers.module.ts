import { Module } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supplier } from './entities/supplier.entity';
import { Country } from '../catalogs/entities/country.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Supplier, Country])],
  controllers: [SuppliersController],
  providers: [SuppliersService],
})
export class SuppliersModule { }
