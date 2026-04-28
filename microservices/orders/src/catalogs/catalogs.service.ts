import { Inject, Injectable } from '@nestjs/common';
import { Brand } from './entities/brand.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Model } from './entities/model.entity';
import { DeviceType } from './entities/device_type.entity';
import { OrderType } from './entities/order-type.entity';
import { OrderPriority } from './entities/order-priority.entity';
import { OrderStatus } from './entities/order_status.entity';

@Injectable()
export class CatalogsService {
    constructor(
        @Inject('MYSQL_READ_ONLY')
        private mysql,
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
    /**
 * Sincroniza las tablas Brands y Models desde la base MySQL hacia PostgreSQL.
 * Solo inserta los registros que no existan en la caché local, manteniendo consistencia sin duplicados.
 */
    async syncBranchModels() {
        // ==========================
        // 1. Leer datos desde MySQL
        // ==========================
        const [brands] = await this.mysql.query(`SELECT * FROM brands`);
        const [models] = await this.mysql.query(`SELECT * FROM models`);

        // ==========================
        // 2. Leer PostgreSQL (estado actual)
        // ==========================
        const pgBrands = await this.brandRepo.find();
        const pgModels = await this.modelRepo.find();

        // ==========================
        // Utilidad: inserción por lotes
        // ==========================
        const insertInBatches = async (
            repo: any,
            items: any[],
            batchSize = 1000
        ) => {
            for (let i = 0; i < items.length; i += batchSize) {
                const batch = items.slice(i, i + batchSize);
                await repo.save(batch);
            }
        };

        // =====================================================
        // 3. SINCRONIZAR MARCAS (SIEMPRE PRIMERO)
        // =====================================================
        const existingBrandsSet = new Set(
            pgBrands.map(b => b.brands_find_id)
        );

        const newBrands = brands
            .filter(b => !existingBrandsSet.has(b.brands_find_id))
            .map(b => ({
                brands_id: b.brands_id,
                brands_find_id: b.brands_find_id,
                brands_name: b.brands_name,
                brands_devices_count: b.brands_devices_count,
                brands_laptops_count: b.brands_laptops_count,
            }));

        if (newBrands.length > 0) {
            await insertInBatches(this.brandRepo, newBrands, 300);
        }

        // =====================================================
        // 4. RELEER MARCAS (CRÍTICO EN PRODUCCIÓN)
        // =====================================================
        const syncedBrands = await this.brandRepo.find();
        const syncedBrandIds = new Set(
            syncedBrands.map(b => b.brands_id)
        );

        // =====================================================
        // 5. SINCRONIZAR MODELOS (VALIDANDO FK)
        // =====================================================
        const existingModelsSet = new Set(
            pgModels.map(m => m.models_find_id)
        );

        const newModels = models
            .filter(m => !existingModelsSet.has(m.models_find_id))
            // 🔴 Evita violación de FK en producción
            .filter(m => syncedBrandIds.has(m.models_brands_id))
            .map(m => ({
                models_id: m.models_id,
                models_find_id: m.models_find_id,
                models_name: m.models_name,
                models_brands_id: m.models_brands_id,
                models_img_url: m.models_img_url,
                models_description: m.models_description,
            }));

        if (newModels.length > 0) {
            await insertInBatches(this.modelRepo, newModels, 1000);
        }

        // =====================================================
        // 6. RESPUESTA FINAL
        // =====================================================
        if (newBrands.length === 0 && newModels.length === 0) {
            return {
                message: 'Sincronización omitida: no se detectaron cambios',
                brands: syncedBrands.length,
                models: pgModels.length,
            };
        }

        return {
            message: 'Sincronización realizada correctamente',
            insertedBrands: newBrands.length,
            insertedModels: newModels.length,
            totalBrandsMysql: brands.length,
            totalModelsMysql: models.length,
            totalBrandsPostgres: syncedBrands.length,
            totalModelsPostgres: pgModels.length + newModels.length,
        };
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
}
