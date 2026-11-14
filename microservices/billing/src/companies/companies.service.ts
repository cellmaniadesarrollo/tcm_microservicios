import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CompanyReplica } from './entities/company-replica.entity';
import { BranchReplica } from './entities/branch-replica.entity';
import { Repository,In } from 'typeorm';

@Injectable()
export class CompaniesService {
    constructor(
        @InjectRepository(CompanyReplica)
        private readonly companyRepo: Repository<CompanyReplica>,

        @InjectRepository(BranchReplica)
        private readonly branchRepo: Repository<BranchReplica>,
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

        /** 2️⃣ UPSERT Branches */
        for (const branch of company.branches) {
            await this.branchRepo.save({
                id: branch.id,
                name: branch.name,
                address: branch.address,
                reference: branch.reference,
                phone: branch.phone,
                code: branch.code,
                location: branch.location, // 👈 PostGIS
                status: branch.status,
                company: { id: company.id },
            });
        }

        console.log(`✅ Company ${company.id} sincronizada`);
    }
     /**
      * Obtiene la última fecha de actualización (updatedAt)
      * de las compañías replicadas.
      * 
      * @returns Date | null
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
      * Sincronización masiva de compañías y sucursales.
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
            select: ['id'],
            where: { id: In(incomingCompanyIds) },
        });

        const existingIds = new Set(existingCompanies.map(c => c.id));

        const companiesToSave: CompanyReplica[] = [];
        const branchesToSave: BranchReplica[] = [];

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

            // 🔹 Branches
            if (company.branches?.length) {
                for (const branch of company.branches) {
                    const branchEntity = this.branchRepo.create({
                        id: branch.id,
                        name: branch.name,
                        address: branch.address,
                        code: branch.code,
                        status: branch.status,
                        location: branch.location ?? undefined,
                        company: companyEntity,
                    });

                    branchesToSave.push(branchEntity);
                }
            }
        }

        // 🔹 Guardar compañías (upsert)
        await this.companyRepo.save(companiesToSave);

        // 🔹 Guardar sucursales (upsert)
        if (branchesToSave.length) {
            await this.branchRepo.save(branchesToSave);
        }

        console.log(
            `✅ Sync compañías OK | Total: ${companiesToSave.length} | Branches: ${branchesToSave.length}`,
        );
    }

}
