import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource, EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CompanyReplica } from '../companies/entities/company-replica.entity';
import { ProductKind } from '../common/enums/product-kind.enum';
import { ProductType } from './entities/product-type.entity';
import { Color } from './entities/color.entity';
import { Quality } from './entities/quality.entity';

import productTypesSeed from './seeds/product-types.json';
import colorsSeed from './seeds/colors.json';
import productUsagesSeed from './seeds/product-usages.json';
import qualitiesSeed from './seeds/qualities.json';
import productNamesSeed from './seeds/product-names.json';
import { Brand } from '../devices-replica/entities/brand.entity';
import { Model } from '../devices-replica/entities/model.entity';
import { cleanDisplayName, normalizeNameKey } from '../common/helpers/normalize-name';
import { ProductName } from './entities/product-name.entity';
import { WarehouseArea } from '../products/enums/product.enums';
import { ProductUsage } from './entities/product-usage.entity';

/** Clave del advisory lock: evita que varias instancias siembren a la vez. */
const SEED_LOCK_KEY = 730_100_1;
const INSERT_CHUNK = 500;
export interface SelectOption {
    id: string | number;
    name: string;
}
export interface UsageOption {
    id: string;          // UUID de product_usages (es lo que se envía al crear el producto)
    code: string;        // SELLABLE, REPAIR_PART, CUSTOMIZABLE...
    name: string;
    area: WarehouseArea;
}
export interface PartRequestFormOptions {
    types: SelectOption[];
    colors: SelectOption[];
    qualities: SelectOption[];
    brands: SelectOption[];
    names: SelectOption[];
    kinds: SelectOption[];
    usages: UsageOption[];
}
@Injectable()
export class ProductCatalogsService implements OnApplicationBootstrap {
    private readonly logger = new Logger(ProductCatalogsService.name);

    constructor(private readonly dataSource: DataSource) { }

    /** Al iniciar la aplicación: completa los catálogos de TODAS las empresas ya replicadas. */
    async onApplicationBootstrap(): Promise<void> {
        await this.seedAllCompanies();
    }

    async seedAllCompanies(): Promise<void> {
        await this.dataSource.transaction(async (em) => {
            await em.query('SELECT pg_advisory_xact_lock($1)', [SEED_LOCK_KEY]);
            const companies = await em.find(CompanyReplica, { select: { id: true } });
            await this.seed(em, companies.map((c) => c.id));
        });
    }

    /** Llamar desde el consumer de la réplica cuando llega una empresa nueva. */
    async seedCompany(companyId: string): Promise<void> {
        await this.dataSource.transaction(async (em) => {
            await em.query('SELECT pg_advisory_xact_lock($1)', [SEED_LOCK_KEY]);
            await this.seed(em, [companyId]);
        });
    }

    // ------------------------------------------------------------------

    private async seed(em: EntityManager, companyIds: string[]): Promise<void> {
        if (companyIds.length === 0) {
            this.logger.log('Seed de catálogos: no hay empresas replicadas todavía.');
            return;
        }

        const types = await this.insertMissing(
            em, ProductType, companyIds,
            productTypesSeed.map((t) => ({
                kind: t.kind as ProductKind,
                code: t.code,
                name: t.name,
            })),
        );

        const colors = await this.insertMissing(
            em, Color, companyIds,
            colorsSeed.map((c) => ({ name: c.name, hex: c.hex })),
        );

        const qualities = await this.insertMissing(
            em, Quality, companyIds,
            qualitiesSeed.map((q) => ({ code: q.code, name: q.name, isSystem: q.isSystem })),
        );

        const names = await this.insertMissing(
            em, ProductName, companyIds,
            productNamesSeed.map((n) => {
                const name = cleanDisplayName(n.name);
                return { name, normalizedKey: normalizeNameKey(name) };
            }),
        );
        const usages = await this.insertMissing(
            em, ProductUsage, companyIds,
            productUsagesSeed.map((u) => ({
                code: u.code,
                name: u.name,
                area: u.area as WarehouseArea,
                isSystem: u.isSystem,
            })),
        );
        this.logger.log(
            `Seed de catálogos (${companyIds.length} empresa/s): ` +
            `+${types} tipos, +${colors} colores, +${qualities} calidades, +${names} nombres`,
        );
    }

    /**
     * Inserta solo lo que no existe (INSERT ... ON CONFLICT DO NOTHING).
     * La clave natural la dan los UNIQUE de cada tabla, por lo que nunca
     * sobrescribe lo que el usuario haya editado ni duplica.
     * Devuelve cuántas filas se insertaron realmente.
     */
    private async insertMissing<T extends ObjectLiteral>(
        em: EntityManager,
        entity: EntityTarget<T>,
        companyIds: string[],
        template: QueryDeepPartialEntity<T>[],
    ): Promise<number> {
        const rows = companyIds.flatMap((companyId) =>
            template.map((t) => ({ ...t, companyId })),
        );

        let inserted = 0;
        for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
            const result = await em
                .createQueryBuilder()
                .insert()
                .into(entity)
                .values(rows.slice(i, i + INSERT_CHUNK) as QueryDeepPartialEntity<T>[])
                .orIgnore()
                .returning('id')
                .execute();
            inserted += result.raw.length;
        }
        return inserted;
    }
    /** Datos para llenar los selects del formulario "nueva solicitud de repuesto". */
    async getPartRequestFormOptions(companyId: string): Promise<PartRequestFormOptions> {
        const where = { companyId, status: true };
        const select = { id: true, name: true } as const;
        const order = { name: 'ASC' } as const;

        const [types, colors, qualities, brands, names, usages] = await Promise.all([
            this.dataSource.getRepository(ProductType).find({ where, select, order }),
            this.dataSource.getRepository(Color).find({ where, select, order }),
            this.dataSource.getRepository(Quality).find({ where, select, order }),
            this.dataSource
                .getRepository(Brand)
                .createQueryBuilder('b')
                .select('b.brands_id', 'id')
                .addSelect('b.brands_name', 'name')
                .orderBy('b.brands_name', 'ASC')
                .getRawMany<SelectOption>(),
            this.dataSource.getRepository(ProductName).find({ where, select, order }),
            this.dataSource.getRepository(ProductUsage).find({
                where,
                select: { id: true, code: true, name: true, area: true },
                order,
            }),
        ]);

        return {
            types, colors, qualities, brands, names,
            kinds: Object.values(ProductKind).map((k) => ({ id: k, name: k })),
            usages,
        };
    }

    async findModelsByBrand(brandId: number, search?: string): Promise<{ id: number; name: string }[]> {
        const qb = this.dataSource
            .getRepository(Model)
            .createQueryBuilder('m')
            .select('m.models_id', 'id')
            .addSelect('m.models_name', 'name') // ← ajusta al nombre real de la columna
            .where('m.brand = :brandId', { brandId }) // ← ajusta si la FK se llama distinto
            .orderBy('m.models_name', 'ASC');

        if (search?.trim()) {
            qb.andWhere('m.models_name ILIKE :search', { search: `%${search.trim()}%` });
        }

        const rows = await qb.getRawMany<{ id: number | string; name: string }>();
        return rows.map((r) => ({ id: Number(r.id), name: r.name }));
    }
}
