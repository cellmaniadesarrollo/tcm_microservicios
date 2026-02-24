import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';

import { Country } from './entities/country.entity';
import { Province } from './entities/province.entity';
import { City } from './entities/city.entity';
import { Gender } from './entities/gender.entity';
import { IdType } from './entities/id-type.entity';
import { ContactType } from './entities/contact-type.entity';

import * as fs from 'fs/promises';
import * as path from 'path';
import { IdentificationType } from './entities/identificationType.entity';

@Injectable()
export class CatalogsService implements OnModuleInit {
  constructor(
@InjectRepository(Country) private readonly countryRepo: Repository<Country>,
    @InjectRepository(Province) private readonly provinceRepo: Repository<Province>,
    @InjectRepository(City) private readonly cityRepo: Repository<City>,
    @InjectRepository(Gender) private readonly genderRepo: Repository<Gender>,
    @InjectRepository(IdType) private readonly idTypeRepo: Repository<IdType>,
    @InjectRepository(ContactType) private readonly contactTypeRepo: Repository<ContactType>,
    @InjectRepository(IdentificationType) private readonly identificationTypeRepo: Repository<IdentificationType>,
  ) { }
async onModuleInit() {
    console.log('--- Verificando catálogos iniciales ---');
    await this.seedEcuador();
  }
  private async loadLocalJson() {
    try {
      const jsonPath = path.join(__dirname, 'data', 'ecuador.json');
      const raw = await fs.readFile(jsonPath, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('❌ Error leyendo JSON local', err);
      throw new RpcException('No se pudo leer el JSON local');
    }
  }

  /** Poblar catálogos básicos */
  /** Poblar catálogos básicos */
  private async seedBasicCatalogs() {
    /** Genders */
    const genders = ['MASCULINO', 'FEMENINO', 'OTRO'];

    for (const g of genders) {
      const exists = await this.genderRepo.findOne({ where: { name: g } });
      if (!exists) {
        await this.genderRepo.save(this.genderRepo.create({ name: g }));
      }
    }

    /** ID Types */
    const idTypes = ['CÉDULA', 'PASAPORTE', 'RUC'];

    for (const idt of idTypes) {
      const exists = await this.idTypeRepo.findOne({ where: { name: idt } });
      if (!exists) {
        await this.idTypeRepo.save(this.idTypeRepo.create({ name: idt }));
      }
    }

    /** Contact Types */
    const contactTypes = ['MÓVIL', 'EMAIL', 'TELÉFONO', 'OTRO'];

    for (const ct of contactTypes) {
      const exists = await this.contactTypeRepo.findOne({ where: { name: ct } });
      if (!exists) {
        await this.contactTypeRepo.save(this.contactTypeRepo.create({ name: ct }));
      }
    }

    /** Identification Types (SRI) */
    const identificationTypes = [
      { code: '04', name: 'RUC' },
      { code: '05', name: 'Cédula' },
      { code: '06', name: 'Pasaporte' },
      { code: '07', name: 'Consumidor Final' },
      { code: '08', name: 'Identificación del Exterior' },
    ];

    for (const it of identificationTypes) {
      const exists = await this.identificationTypeRepo.findOne({
        where: { code: it.code },
      });

      if (!exists) {
        await this.identificationTypeRepo.save(
          this.identificationTypeRepo.create(it),
        );
      }
    }

    console.log('✔ Catálogos básicos creados correctamente');
  }


  /** Poblar Ecuador */
  /** Tu método seedEcuador ajustado para evitar duplicidad de Provincias/Ciudades */

  async seedEcuador() {
    try {
      // Verificamos si ya existe el país para no re-procesar todo el JSON
      const countryExists = await this.countryRepo.findOne({ where: { name: 'ECUADOR' } });

      if (countryExists) {
        // Opcional: Si el país existe, podrías saltarte el proceso de provincias/ciudades
        // Pero llamamos a seedBasicCatalogs por si acaso faltan géneros o tipos de ID
        await this.seedBasicCatalogs();
        console.log('✔ Los datos de Ecuador ya existen. Saltando carga de JSON.');
        return { message: 'Datos ya cargados anteriormente' };
      }

      const data = await this.loadLocalJson();

      /** País */
      const country = await this.countryRepo.save(
        this.countryRepo.create({ name: 'ECUADOR' }),
      );

      /** Provincias */
      for (const provKey of Object.keys(data)) {
        const provObj = data[provKey];
        if (!provObj?.provincia) continue;
        const provinceName = String(provObj.provincia).toUpperCase();

        const province = await this.provinceRepo.save(
          this.provinceRepo.create({ name: provinceName, country }),
        );

        /** Cantones */
        if (!provObj.cantones) continue;
        for (const cantKey of Object.keys(provObj.cantones)) {
          const cantonObj = provObj.cantones[cantKey];
          if (!cantonObj?.canton) continue;
          const cantonName = String(cantonObj.canton).toUpperCase();

          await this.cityRepo.save(this.cityRepo.create({ name: cantonName, province }));

          /** Parroquias */
          if (!cantonObj.parroquias) continue;
          for (const parrKey of Object.keys(cantonObj.parroquias)) {
            const parroquiaName = cantonObj.parroquias[parrKey];
            if (!parroquiaName) continue;
            const parrUpper = String(parroquiaName).toUpperCase();
            if (parrUpper === cantonName) continue;

            await this.cityRepo.save(this.cityRepo.create({ name: parrUpper, province }));
          }
        }
      }

      /** Poblar catálogos básicos */
      await this.seedBasicCatalogs();
      return { message: 'Catálogos y datos de Ecuador cargados correctamente' };
    } catch (error) {
      console.error('❌ Error en Seeding:', error);
      // No lanzamos RpcException aquí para que la app no se caiga si falla el seed al iniciar
    }
  }


  /** Obtener datos iniciales del catálogo */
  async getInitialCatalogs() {
    try {
      const countries = await this.countryRepo.find({
        order: { name: 'ASC' },
      });

      const provinces = await this.provinceRepo.find({
        relations: ['country'],
        order: { name: 'ASC' },
      });

      const genders = await this.genderRepo.find({
        order: { name: 'ASC' },
      });

      const idTypes = await this.idTypeRepo.find({
        order: { name: 'ASC' },
      });

      const contactTypes = await this.contactTypeRepo.find({
        order: { name: 'ASC' },
      });

      return {
        countries,
        provinces,
        genders,
        idTypes,
        contactTypes,
      };
    } catch (error) {
      console.error(error);
      throw new RpcException('Error obteniendo datos iniciales del catálogo');
    }
  }

  /** Obtener ciudades por provincia */
  async getCitiesByProvince(provinceId: number) {
    try {
      const cities = await this.cityRepo.find({
        where: { province: { id: provinceId } },
        order: { name: 'ASC' },
      });

      return cities;
    } catch (error) {
      console.error(error);
      throw new RpcException('Error obteniendo ciudades por provincia');
    }
  }
  async getInitialCatalogsBilling() {
    try {
      const identificationtype = await this.identificationTypeRepo.find({
        order: { code: 'ASC' },
      });
      return {
        identificationtype,
      };
    } catch (error) {
      console.error(error);
      throw new RpcException('Error obteniendo datos iniciales del catálogo');
    }
  }
}
