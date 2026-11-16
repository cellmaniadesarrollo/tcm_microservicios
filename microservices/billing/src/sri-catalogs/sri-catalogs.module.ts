import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SriAuthorizationStatus } from './entities/sri-authorization-status';
import { SriDocumentType } from './entities/sri-document-type.entitty';
import { SriEmissionType } from './entities/sri-emission-type.entity';
import { SriEnvironment } from './entities/sri-environment.entity';
import { SriErrorCode } from './entities/sri-error-code.entity';
import { SriTaxType } from './entities/sri-tax-type.entity';
import { SriVatRate } from './entities/sri-vat-rate.entity';
import { SriWithholdingRate } from './entities/sri-withholding-rate.entity';
import { SriWithholdingType } from './entities/sri-withholding-type.entity';
import { SriCatalogsSeed } from './seed/sri-catalogs.seed';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SriDocumentType, SriEnvironment, SriEmissionType, SriAuthorizationStatus,
      SriVatRate, SriWithholdingType, SriWithholdingRate, SriTaxType, SriErrorCode,
    ]),
  ],
  providers: [SriCatalogsSeed],
})
export class SriCatalogsModule {}