import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { Branch } from '../branches/entities/branch.entity';
import { BroadcastService } from '../broadcast/broadcast.service';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly broadcast: BroadcastService,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
  ) { }

  async createCompanyWithMainBranch(dto: any) {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const companyExists = await queryRunner.manager.findOne(Company, {
        where: { name: dto.name },
      });

      if (companyExists) {
        throw new ConflictException('La compañía ya existe');
      }

      const company = queryRunner.manager.create(Company, {
        name: dto.name,
        status: dto.status ?? true,
        maxUsers: dto.maxUsers ?? 5,
        email: dto.email,
      });

      const savedCompany = await queryRunner.manager.save(company);

      const branch = queryRunner.manager.create(Branch, {
        name: dto.mainBranch.name,
        address: dto.mainBranch.address,
        reference: dto.mainBranch.reference,
        phone: dto.mainBranch.phone,
        code: dto.mainBranch.code,
        location: dto.mainBranch.location,
        status: true,
        company: savedCompany,
      });

      const savedBranch = await queryRunner.manager.save(branch);

      await queryRunner.commitTransaction();

      const fullData = await this.companyRepository.findOne({
        where: { id: savedCompany.id },
        relations: { branches: true },
      });

      // ✅ Antes: this.broadcast.publish('companies.created', { internalToken, company })
      // ✅ Ahora: Kafka — sin internalToken, los ms confían en la red interna
      await this.broadcast.publishCompanyCreated(fullData);

      return {
        company: savedCompany,
        mainBranch: savedBranch,
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findFullDataByCreatedAfter(fromCache: string | null): Promise<Company[]> {
    if (!fromCache) {
      return this.companyRepository.find({
        relations: { branches: true },
        order: { updatedAt: 'ASC' },
      });
    }

    const date = new Date(fromCache);

    return this.companyRepository
      .createQueryBuilder('company')
      .leftJoinAndSelect('company.branches', 'branch')
      .where('company.createdAt > :date', { date })
      .orWhere('company.updatedAt > :date', { date })
      .orderBy('company.updatedAt', 'ASC')
      .getMany();
  }
}