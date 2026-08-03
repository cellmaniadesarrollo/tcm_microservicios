import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CompanyReplica } from './entities/company-replica.entity';
import { BranchReplica } from './entities/branch-replica.entity';
import { Repository, In } from 'typeorm';
import { SubscriptionsModuleService } from '../subscriptions-module/subscriptions-module.service';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(CompanyReplica)
    private readonly companyRepo: Repository<CompanyReplica>,

    @InjectRepository(BranchReplica)
    private readonly branchRepo: Repository<BranchReplica>,
    private readonly subscriptionsService: SubscriptionsModuleService
  ) { }

  /* ===============================
   * 🔁 Sync en tiempo real (1 company)
   * =============================== */
  async syncCompany(company: any): Promise<void> {
    /** 1️⃣ UPSERT Company */
    const companyEntity = this.companyRepo.create({
      id: company.id,
      status: company.status,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    });

    await this.companyRepo.save(companyEntity);

    /** 2️⃣ UPSERT Branches */
    if (company.branches?.length) {
      const branches = company.branches.map(branch =>
        this.branchRepo.create({
          id: branch.id,
          company: companyEntity,
        }),
      );

      await this.branchRepo.save(branches);
    }

    console.log(`✅ Company ${company.id} sincronizada`);
  }

  /* =====================================
   * ⏱️ Última fecha de actualización
   * ===================================== */
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

  /* =====================================
   * 🔄 Sync masivo (bulk / inicial)
   * ===================================== */
  async syncCompanyBulk(payload: any[]): Promise<void> {
    if (!payload?.length) return;

    // 🔍 IDs del payload
    const companyIds = payload.map(c => c.id);

    // 🔍 Companies que ya existen
    const existingCompanies = await this.companyRepo.find({
      select: ['id'],
      where: { id: In(companyIds) },
    });

    const existingIds = new Set(existingCompanies.map(c => c.id));

    const companiesToSave: CompanyReplica[] = [];
    const branchesToSave: BranchReplica[] = [];
    const newCompanyIds: string[] = [];

    for (const company of payload) {
      const companyEntity = this.companyRepo.create({
        id: company.id,
        status: company.status,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
      });

      companiesToSave.push(companyEntity);

      // 🆕 Solo las nuevas
      if (!existingIds.has(company.id)) {
        newCompanyIds.push(company.id);
      }

      if (company.branches?.length) {
        for (const branch of company.branches) {
          branchesToSave.push(
            this.branchRepo.create({
              id: branch.id,
              company: companyEntity,
            }),
          );
        }
      }
    }

    await this.companyRepo.save(companiesToSave);

    if (branchesToSave.length) {
      await this.branchRepo.save(branchesToSave);
    }

    // 🧾 Crear suscripción SOLO para companies nuevas
    for (const companyId of newCompanyIds) {
      await this.subscriptionsService.registerDefaultSubscription(companyId);
    }

    console.log(
      `✅ Sync masivo OK | Companies: ${companiesToSave.length} | Nuevas: ${newCompanyIds.length}`,
    );
  }

}
