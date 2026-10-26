import { BadRequestException, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource, EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { RpcException } from '@nestjs/microservices';
import { Country } from './entities/country.entity';
import { ReceiptDocumentType } from './entities/receipt-document-type.entity';
import { CompanyReplica } from '../companies/entities/company-replica.entity'; // Ajusta la ruta según tu estructura

const SEED_LOCK_KEY = 730_100_2; // Clave única de advisory lock para este servicio
const INSERT_CHUNK = 500;

const SEED_COUNTRIES: Array<{ code: string; name: string }> = [
    { code: 'EC', name: 'ECUADOR' },
    { code: 'PE', name: 'PERU' },
    { code: 'CO', name: 'COLOMBIA' },
    { code: 'CN', name: 'CHINA' },
    { code: 'US', name: 'ESTADOS UNIDOS' },
];

export const RECEIPT_DOCUMENT_TYPES_SEED: ReadonlyArray<{
    code: string;
    name: string;
    forcesBillableLot: boolean;
}> = [
        { code: '01', name: 'FACTURA', forcesBillableLot: true },
        { code: '03', name: 'LIQUIDACIÓN DE COMPRAS DE BIENES Y PRESTACIONES DE SERVICIOS', forcesBillableLot: false },
        { code: '04', name: 'NOTA DE CRÉDITO', forcesBillableLot: false },
        { code: '05', name: 'NOTA DE DÉBITO', forcesBillableLot: false },
        { code: '06', name: 'GUÍA DE REMISIÓN', forcesBillableLot: false },
        { code: '07', name: 'COMPROBANTE DE RETENCIÓN', forcesBillableLot: false },
        { code: 'S/N', name: 'RECIBOS', forcesBillableLot: false },
        { code: 'S/NR', name: 'DEVOLUCION DE PRODUCTOS', forcesBillableLot: false },
    ];

@Injectable()
export class CatalogsService implements OnApplicationBootstrap {
    private readonly logger = new Logger(CatalogsService.name);

    constructor(private readonly dataSource: DataSource) { }

    /** Al iniciar la aplicación: siembra países globalmente y tipos de documento para TODAS las empresas. */
    async onApplicationBootstrap(): Promise<void> {
        await this.seedCountriesGlobal();
        await this.seedAllCompaniesReceiptDocumentTypes();
    }

    /** Siembra global de países (al iniciar) */
    private async seedCountriesGlobal(): Promise<void> {
        const repo = this.dataSource.getRepository(Country);
        for (const seed of SEED_COUNTRIES) {
            const exists = await repo.findOne({ where: { code: seed.code } });
            if (!exists) {
                await repo.save(repo.create(seed));
            }
        }
        this.logger.log(`Catálogo de países verificado (${SEED_COUNTRIES.length} base)`);
    }

    /** Siembra masiva de tipos de documento para todas las empresas existentes */
    async seedAllCompaniesReceiptDocumentTypes(): Promise<void> {
        await this.dataSource.transaction(async (em) => {
            await em.query('SELECT pg_advisory_xact_lock($1)', [SEED_LOCK_KEY]);
            const companies = await em.find(CompanyReplica, { select: { id: true } });
            const companyIds = companies.map((c) => c.id);

            if (companyIds.length === 0) {
                this.logger.log('Seed de tipos de documento: no hay empresas replicadas todavía.');
                return;
            }

            const insertedCount = await this.insertMissing(
                em,
                ReceiptDocumentType,
                companyIds,
                RECEIPT_DOCUMENT_TYPES_SEED.map((t) => ({
                    code: t.code,
                    name: t.name,
                    forcesBillableLot: t.forcesBillableLot,
                    isSystem: true,
                })),
            );

            this.logger.log(`Seed de tipos de documento (${companyIds.length} empresa/s): +${insertedCount} registros insertados.`);
        });
    }

    // ==========================================
    // SECCIÓN: PAÍSES (Globales)
    // ==========================================
    listCountries() {
        return this.dataSource.getRepository(Country).find({
            where: { status: true },
            select: { id: true, code: true, name: true },
            order: { name: 'ASC' },
        });
    }

    async assertCountryExists(id: string) {
        const ok = await this.dataSource.getRepository(Country).exists({ where: { id, status: true } });
        if (!ok) throw new RpcException(new BadRequestException('El país no existe o está inactivo'));
    }

    // ==========================================
    // SECCIÓN: TIPOS DE DOCUMENTO (Por Empresa)
    // ==========================================

    /** Siembra idempotente individual (ej. cuando llega una empresa nueva mediante un consumer) */
    async seedReceiptDocumentTypes(companyId: string, manager?: EntityManager): Promise<void> {
        const em = manager || this.dataSource.manager;

        await em.getRepository(ReceiptDocumentType).upsert(
            RECEIPT_DOCUMENT_TYPES_SEED.map((t) => ({
                companyId,
                code: t.code,
                name: t.name,
                forcesBillableLot: t.forcesBillableLot,
                isSystem: true,
            })),
            ['companyId', 'code'],
        );
    }

    listReceiptDocumentTypes(companyId: string) {
        return this.dataSource.getRepository(ReceiptDocumentType).find({
            where: { companyId },
            order: { code: 'ASC' },
        });
    }

    /**
     * Inserta en bloques de forma masiva solo lo que no existe (ON CONFLICT DO NOTHING).
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
}