import { Module } from '@nestjs/common';
import { CatalogsController } from './catalogs.controller';
import { CatalogsService } from './catalogs.service';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Country } from './entities/country.entity';
import { Province } from './entities/province.entity';
import { City } from './entities/city.entity';
import { Gender } from './entities/gender.entity';
import { IdType } from './entities/id-type.entity';
import { ContactType } from './entities/contact-type.entity';
import { IdentificationType } from './entities/identificationType.entity';
@Module({
  imports: [TypeOrmModule.forFeature([Country, Province, City,Gender,IdType,ContactType,IdentificationType])],
  controllers: [CatalogsController],
  providers: [CatalogsService]
})
export class CatalogsModule {}
