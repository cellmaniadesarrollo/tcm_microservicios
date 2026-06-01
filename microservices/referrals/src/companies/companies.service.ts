import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CompanyReplica } from './entities/company-replica.entity';
import { Repository, In } from 'typeorm';

@Injectable()
export class CompaniesService {
    constructor(
        @InjectRepository(CompanyReplica)
        private readonly companyRepo: Repository<CompanyReplica>,
    ) { }

    async syncCompany(company: any) {
        /** 1️⃣ UPSERT Company */
        await this.companyRepo.save({
            id: company.id,
            name: company.name,
            status: company.status,
            maxUsers: company.maxUsers,
            createdAt: company.createdAt,
            updatedAt: company.updatedAt,
        });

        console.log(`✅ Company ${company.id} sincronizada`);
    }

    /**
     * Obtiene la última fecha de actualización (updatedAt)
     * de las compañías replicadas.
     * * @returns Date | null
     * - Date: si existe al menos un registro
     * - null: si la tabla está vacía
     */
    async getLastUpdatedAt(): Promise<Date | null> {
        const result = await this.companyRepo
            .createQueryBuilder('company')
            .select('company.updatedAt', 'updatedAt')
            .where('company.updatedAt IS NOT NULL')
            .orderBy('company.updatedAt', 'DESC')
            .limit(1)
            .getRawOne();

        return result?.updatedAt ?? null;
    }

    /**
     * Sincronización masiva de compañías.
     * - Inserta si no existe
     * - Actualiza si ya existe
     * - Soporta sync inicial o incremental
     */
    async syncCompanyBulk(payload: any[]): Promise<void> {
        if (!payload || payload.length === 0) return;

        // 🔹 IDs entrantes
        const incomingCompanyIds = payload.map(c => c.id);

        // 🔹 IDs existentes en réplica
        const existingCompanies = await this.companyRepo.find({
            select: { id: true },
            where: { id: In(incomingCompanyIds) },
        });

        const existingIds = new Set(existingCompanies.map(c => c.id));
        const companiesToSave: CompanyReplica[] = [];

        for (const company of payload) {
            const companyEntity = this.companyRepo.create({
                id: company.id,
                name: company.name,
                status: company.status,
                maxUsers: company.maxUsers,
                createdAt: company.createdAt,
                updatedAt: company.updatedAt,
            });

            companiesToSave.push(companyEntity);
        }

        // 🔹 Guardar compañías (upsert)
        await this.companyRepo.save(companiesToSave);

        console.log(
            `✅ Sync compañías OK | Total: ${companiesToSave.length}`,
        );
    }
}