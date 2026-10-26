import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { IdentificationType } from './enums/supplier.enums';
import { Country } from '../catalogs/entities/country.entity';
import { Brackets, DataSource, QueryFailedError, Repository } from 'typeorm';
import { CreateSupplierPayload } from './dto/create-supplier.payload';
import { RpcException } from '@nestjs/microservices';
import { Supplier } from './entities/supplier.entity';
import { ListSuppliersPayload } from './dto/list-suppliers.payload';
import { UpdateSupplierPayload } from './dto/update-supplier.payload';
const IDENTIFICATION_TYPE_LABELS: Record<IdentificationType, string> = {
    [IdentificationType.RUC]: 'RUC',
    [IdentificationType.CEDULA]: 'Cédula',
    [IdentificationType.PASSPORT]: 'Pasaporte',
    [IdentificationType.FOREIGN_ID]: 'Identificación del exterior',
};
const PG_UNIQUE_VIOLATION = '23505';

// Formato por tipo. FOREIGN_ID y PASSPORT son libres (solo no vacíos).
const IDENTIFICATION_RULES: Partial<Record<IdentificationType, { regex: RegExp; message: string }>> = {
    [IdentificationType.RUC]: { regex: /^\d{13}$/, message: 'El RUC debe tener 13 dígitos' },
    [IdentificationType.CEDULA]: { regex: /^\d{10}$/, message: 'La cédula debe tener 10 dígitos' },
};
const SORT_COLUMNS: Record<NonNullable<ListSuppliersPayload['sortBy']>, string> = {
    createdAt: 's.createdAt',
    code: 's.code',
    name: 's.businessName',
    identification: 's.identificationNumber',
};

const MAX_SEARCH_TOKENS = 5;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');
@Injectable()
export class SuppliersService {
    constructor(
        @InjectRepository(Country)
        private readonly countryRepo: Repository<Country>,
        @InjectRepository(Supplier) private readonly supplierRepo: Repository<Supplier>,
        @InjectDataSource() private readonly dataSource: DataSource,
    ) { }

    async getFormOptions() {
        const countries = await this.countryRepo.find({
            select: { id: true, name: true }, // AJUSTA a las columnas reales de Country
            order: { name: 'ASC' },
        });

        const identificationTypes = Object.values(IdentificationType).map((value) => ({
            value,
            label: IDENTIFICATION_TYPE_LABELS[value],
        }));

        return { identificationTypes, countries };
    }
    async create(dto: CreateSupplierPayload, companyId: string) {
        const identificationNumber = dto.identificationNumber.trim();

        const rule = IDENTIFICATION_RULES[dto.identificationType];
        if (rule && !rule.regex.test(identificationNumber)) {
            throw new RpcException(new BadRequestException(rule.message));
        }

        const country = await this.countryRepo.findOne({ where: { id: dto.countryId }, select: { id: true } });
        if (!country) {
            throw new RpcException(new BadRequestException('El país seleccionado no existe'));
        }

        try {
            return await this.dataSource.transaction(async (manager) => {
                const repo = manager.getRepository(Supplier);

                const duplicate = await repo.findOne({
                    where: { companyId, identificationType: dto.identificationType, identificationNumber },
                    select: { id: true, code: true, businessName: true },
                });
                if (duplicate) {
                    throw new RpcException(new ConflictException(
                        `Ya existe un proveedor con esa identificación: #${duplicate.code} ${duplicate.businessName}`,
                    ));
                }

                // Serializa la generación del código por empresa dentro de la transacción
                await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`suppliers_code:${companyId}`]);
                const [{ next }] = await manager.query(
                    'SELECT COALESCE(MAX(code), 0) + 1 AS next FROM suppliers WHERE company_id = $1',
                    [companyId],
                );

                const supplier = repo.create({
                    companyId,
                    code: Number(next),
                    identificationType: dto.identificationType,
                    identificationNumber,
                    businessName: dto.businessName.trim(),
                    tradeName: dto.tradeName?.trim() || undefined,
                    countryId: dto.countryId,
                    address: dto.address.trim(),
                    phone: dto.phone?.trim() || undefined,
                    email: dto.email?.trim().toLowerCase() || undefined,
                });

                return await repo.save(supplier);
            });
        } catch (error: any) {
            if (error instanceof RpcException) throw error;

            // Red de seguridad ante una carrera: el índice único manda
            if (error instanceof QueryFailedError && (error as any).driverError?.code === PG_UNIQUE_VIOLATION) {
                throw new RpcException(new ConflictException('Ya existe un proveedor con esa identificación'));
            }
            throw error;
        }
    }

    async findAll(query: ListSuppliersPayload, companyId: string) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;

        const qb = this.supplierRepo
            .createQueryBuilder('s')
            .leftJoin('s.country', 'c')
            .addSelect(['c.id', 'c.name']) // AJUSTA a las columnas reales de Country
            .where('s.companyId = :companyId', { companyId });

        if (query.status !== undefined) qb.andWhere('s.status = :status', { status: query.status });
        if (query.identificationType) qb.andWhere('s.identificationType = :idType', { idType: query.identificationType });
        if (query.countryId) qb.andWhere('s.countryId = :countryId', { countryId: query.countryId });

        const term = query.search?.trim();
        if (term) {
            // Escapa comodines para que "%" o "_" se busquen literalmente
            const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
            const isCode = /^\d{1,9}$/.test(term);
            qb.andWhere(new Brackets((w) => {
                w.where('s.businessName ILIKE :like', { like })
                    .orWhere('s.tradeName ILIKE :like', { like })
                    .orWhere('s.identificationNumber ILIKE :like', { like });
                if (isCode) w.orWhere('s.code = :code', { code: Number(term) });
            }));
        }

        const sortColumn = SORT_COLUMNS[query.sortBy ?? 'createdAt'];
        qb.orderBy(sortColumn, query.sortDir ?? 'DESC')
            .addOrderBy('s.id', 'ASC') // desempate: evita que la paginación repita o salte filas
            .skip((page - 1) * limit)
            .take(limit);

        const [data, total] = await qb.getManyAndCount();

        return {
            data,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async findOneFull(id: string, companyId: string) {
        const supplier = await this.supplierRepo
            .createQueryBuilder('s')
            .leftJoin('s.country', 'c')
            .addSelect(['c.id', 'c.name']) // AJUSTA a las columnas reales de Country
            .where('s.id = :id', { id })
            .andWhere('s.companyId = :companyId', { companyId }) // nunca devolver proveedores de otra empresa
            .getOne();

        if (!supplier) {
            throw new RpcException(new NotFoundException('Proveedor no encontrado'));
        }
        return supplier;
    }
    async update(id: string, dto: UpdateSupplierPayload, companyId: string) {
        // Lista blanca explícita: identificationType, identificationNumber y code nunca entran aquí
        const patch: Record<string, unknown> = {};

        if (dto.businessName !== undefined) patch.businessName = dto.businessName.trim();
        if (dto.address !== undefined) patch.address = dto.address.trim();
        if (dto.countryId !== undefined) patch.countryId = dto.countryId;
        if (dto.tradeName !== undefined) patch.tradeName = dto.tradeName?.trim() || null;
        if (dto.phone !== undefined) patch.phone = dto.phone?.trim() || null;
        if (dto.email !== undefined) patch.email = dto.email?.trim().toLowerCase() || null;

        if (Object.keys(patch).length === 0) {
            throw new RpcException(new BadRequestException('No hay campos para actualizar'));
        }

        if (dto.countryId !== undefined) {
            const country = await this.countryRepo.findOne({ where: { id: dto.countryId }, select: { id: true } });
            if (!country) {
                throw new RpcException(new BadRequestException('El país seleccionado no existe'));
            }
        }

        // El companyId en el where evita editar proveedores de otra empresa
        const result = await this.supplierRepo.update({ id, companyId }, patch as any);
        if (!result.affected) {
            throw new RpcException(new NotFoundException('Proveedor no encontrado'));
        }

        return this.findOneFull(id, companyId);
    }

    async updateStatus(id: string, status: boolean, companyId: string) {
        const result = await this.supplierRepo.update({ id, companyId }, { status });
        if (!result.affected) {
            throw new RpcException(new NotFoundException('Proveedor no encontrado'));
        }
        return this.findOneFull(id, companyId);
    }




    async searchOptions(
        query: { q?: string; limit?: number; includeInactive?: boolean },
        companyId: string,
    ) {
        const limit = Math.min(query.limit ?? 20, 50);
        const term = (query.q ?? '').trim().replace(/\s+/g, ' ');
        const tokens = term ? term.split(' ').slice(0, MAX_SEARCH_TOKENS) : [];

        const qb = this.supplierRepo
            .createQueryBuilder('s')
            .select([
                's.id', 's.code', 's.identificationType', 's.identificationNumber',
                's.businessName', 's.tradeName', 's.status',
            ])
            .where('s.companyId = :companyId', { companyId });

        if (!query.includeInactive) qb.andWhere('s.status = true');

        // Cada palabra debe aparecer en algún campo (AND entre palabras, OR entre campos)
        tokens.forEach((token, i) => {
            const p = `t${i}`;
            qb.andWhere(new Brackets((w) => {
                w.where(`s.businessName ILIKE :${p}`)
                    .orWhere(`s.tradeName ILIKE :${p}`)
                    .orWhere(`s.identificationNumber ILIKE :${p}`)
                    .orWhere(`s.email ILIKE :${p}`);
                if (/^\d{1,9}$/.test(token)) w.orWhere(`s.code = :${p}n`);
            }));
            qb.setParameter(p, `%${escapeLike(token)}%`);
            if (/^\d{1,9}$/.test(token)) qb.setParameter(`${p}n`, Number(token));
        });

        // Relevancia: identificación o nombre que EMPIEZAN con lo escrito van primero
        if (term) {
            qb.setParameter('prefix', `${escapeLike(term)}%`);
            qb.orderBy(
                `CASE WHEN s.identificationNumber ILIKE :prefix THEN 0
              WHEN s.businessName ILIKE :prefix THEN 1
              WHEN s.tradeName ILIKE :prefix THEN 2
              ELSE 3 END`,
                'ASC',
            ).addOrderBy('s.businessName', 'ASC');
        } else {
            qb.orderBy('s.businessName', 'ASC');
        }
        qb.addOrderBy('s.id', 'ASC').limit(limit);

        const rows = await qb.getMany();

        return rows.map((s) => ({
            id: s.id,
            code: s.code,
            identificationType: s.identificationType,
            identificationNumber: s.identificationNumber,
            businessName: s.businessName,
            tradeName: s.tradeName ?? null,
            status: s.status,
            label: `${s.identificationNumber} - ${s.businessName}`,
        }));
    }
}
