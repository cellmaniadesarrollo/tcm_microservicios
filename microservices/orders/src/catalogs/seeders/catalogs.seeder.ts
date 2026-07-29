import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeoCountry } from '../entities/geo-country.entity';
import { GeoDivision } from '../entities/geo-division.entity';
import * as ecuadorData from './data/ecuador.geo.json';

@Injectable()
export class CatalogsSeeder implements OnModuleInit {
    private readonly logger = new Logger(CatalogsSeeder.name);

    constructor(
        @InjectRepository(GeoCountry)
        private readonly countryRepo: Repository<GeoCountry>,
        @InjectRepository(GeoDivision)
        private readonly divisionRepo: Repository<GeoDivision>,
    ) { }

    async onModuleInit() {
        await this.seedGeo();
    }

    private async seedGeo() {
        const count = await this.countryRepo.count();
        if (count > 0) {
            this.logger.log('Geo data already seeded, skipping.');
            return;
        }

        this.logger.log('Seeding geo data...');

        // 1. País
        const ecuador = this.countryRepo.create({ name: 'Ecuador', code: 'EC' });
        await this.countryRepo.save(ecuador);

        // 2. Provincias → Cantones → Parroquias
        for (const [provCode, provData] of Object.entries(ecuadorData)) {
            const provincia = this.divisionRepo.create({
                country_id: ecuador.id,
                code: provCode,
                name: (provData as any).provincia,
                level: 1,
            });
            await this.divisionRepo.save(provincia);

            for (const [cantonCode, cantonData] of Object.entries((provData as any).cantones)) {
                const canton = this.divisionRepo.create({
                    country_id: ecuador.id,
                    parent_id: provincia.id,
                    code: cantonCode,
                    name: (cantonData as any).canton,
                    level: 2,
                });
                await this.divisionRepo.save(canton);

                for (const [parCode, parName] of Object.entries((cantonData as any).parroquias)) {
                    const parroquia = this.divisionRepo.create({
                        country_id: ecuador.id,
                        parent_id: canton.id,
                        code: parCode,
                        name: parName as string,
                        level: 3,
                    });
                    await this.divisionRepo.save(parroquia);
                }
            }
        }

        this.logger.log('Geo data seeded successfully.');
    }
}