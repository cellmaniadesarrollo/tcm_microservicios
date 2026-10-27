import { Module } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';
import { CatalogsController } from './catalogs.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Country } from './entities/country.entity';
import { ReceiptDocumentType } from './entities/receipt-document-type.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Country, ReceiptDocumentType])],
  controllers: [CatalogsController],
  providers: [CatalogsService],
  exports: [CatalogsService]
})
export class CatalogsModule { }
