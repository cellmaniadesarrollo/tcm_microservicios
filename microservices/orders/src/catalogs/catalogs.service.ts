import { Inject, Injectable } from '@nestjs/common';
import { Brand } from './entities/brand.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Model } from './entities/model.entity';
import { DeviceType } from './entities/device_type.entity';
import { OrderType } from './entities/order-type.entity';
import { OrderPriority } from './entities/order-priority.entity';
import { OrderStatus } from './entities/order_status.entity';
import { GeoDivision } from './entities/geo-division.entity';
import { GeoCountry } from './entities/geo-country.entity';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class CatalogsService {
    constructor(

        @InjectRepository(Brand)
        private readonly brandRepo: Repository<Brand>,

        @InjectRepository(Model)
        private readonly modelRepo: Repository<Model>,
        @InjectRepository(DeviceType)
        private deviceTypeRepo: Repository<DeviceType>,

        @InjectRepository(OrderType)
        private orderTypeRepo: Repository<OrderType>,
        @InjectRepository(OrderPriority)
        private orderPriorityRepo: Repository<OrderPriority>,
        @InjectRepository(OrderStatus)
        private orderStatusRepo: Repository<OrderStatus>,
        @InjectRepository(GeoDivision)
        private divisionRepo: Repository<GeoDivision>,
        @InjectRepository(GeoCountry)
        private countryRepo: Repository<GeoCountry>,

    ) { }


    async populateIfEmpty(): Promise<void> {
        const count = await this.deviceTypeRepo.count();

        if (count === 0) {
            await this.deviceTypeRepo.insert([
                { name: 'CELLPHONE' },
                { name: 'TV' },
                { name: 'TABLET' },
                { name: 'LAPTOP' },
            ]);

            console.log('Device types poblados correctamente.');
        }
        const count2 = await this.orderPriorityRepo.count();

        if (count2 === 0) {
            await this.orderPriorityRepo.insert([
                { name: 'BAJA' },
                { name: 'MEDIA' },
                { name: 'ALTA' },
                { name: 'CRITICA' },
            ]);

            console.log('Order priorities pobladas correctamente.');
        }
        const count1 = await this.orderTypeRepo.count();

        if (count1 === 0) {
            await this.orderTypeRepo.insert([
                { name: 'SERVICIO TECNICO' },
                { name: 'PERSONALIZADO' },
                { name: 'PARA REPUESTOS' },
            ]);

            console.log('Order types poblados correctamente.');
        }
        const countStatus = await this.orderStatusRepo.count();

        if (countStatus === 0) {
            await this.orderStatusRepo.insert([
                { name: 'INGRESADO' },
                { name: 'VISTA' },
                { name: 'EN REVISION' },
                { name: 'EN ESPERA APROBACION' },
                { name: 'EN BUSQUEDA REPUESTO' },
                { name: 'EN REPARACION' },
                { name: 'TRABAJO FINALIZADO' },
                { name: 'ENTREGADA' },
            ]);

            console.log('Order statuses poblados correctamente.');
        }
    }



    async listBrands() {
        const brands = await this.brandRepo.find({
            select: ['brands_id', 'brands_name'],
            order: { brands_name: 'ASC' },
        });

        return brands.map(b => ({
            id: b.brands_id,
            name: b.brands_name,
        }));
    }
    async listOrderStatus() {
        const orderstatus = await this.orderStatusRepo.find();

        return orderstatus
    }
    async getModelsByBrand(brandId: number) {
        const models = await this.modelRepo.find({
            where: { models_brands_id: brandId },
            select: ['models_id', 'models_name'],
            order: { models_name: 'ASC' },
        });
        return models.map(m => ({
            id: m.models_id,
            name: m.models_name,
        }));
    }
    async listDeviceTypes() {
        const types = await this.deviceTypeRepo.find({
            select: {
                id: true,
                name: true,
            },
            order: { name: 'ASC' },
        });

        return types
    }


    async getOrderCatalog(): Promise<any> {
        const orderTypes = await this.orderTypeRepo.find({
            order: { name: 'ASC' }
        });

        const orderPriorities = await this.orderPriorityRepo.find({
            order: { name: 'ASC' }
        });

        return {
            orderTypes,
            orderPriorities,
        };
    }

    /**
     * Obtiene los catálogos necesarios para la sincronización de normalizaciones
     */
    async getNormalizationsData() {
        const [orderStatuses, orderTypes] = await Promise.all([
            this.orderStatusRepo.find(),
            this.orderTypeRepo.find(),
        ]);

        return {
            orderStatuses,
            orderTypes
        };
    }

    async getCountries(): Promise<{ id: number; name: string }[]> {
        const countries = await this.countryRepo.find({ order: { name: 'ASC' } });
        return countries.map(c => ({ id: c.id, name: c.name }));
    }

    async getDivisionsByParent(
        parent_id: number | null,
        country_id: number | null,
        level: number,
    ): Promise<{ id: number; name: string }[]> {
        const where: any = { level };
        if (parent_id !== null) where.parent_id = parent_id;
        if (country_id !== null) where.country_id = country_id;

        const divisions = await this.divisionRepo.find({
            where,
            order: { name: 'ASC' },
        });

        return divisions.map(d => ({ id: d.id, name: d.name }));
    }
}
