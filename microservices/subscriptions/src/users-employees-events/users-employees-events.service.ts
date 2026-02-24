import { Injectable } from '@nestjs/common';
import { UserEmployeeCache } from './entities/user_employee_cache.entity'; 
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, DataSource, In } from 'typeorm';

@Injectable()
export class UsersEmployeesEventsService {
 constructor(
    @InjectRepository(UserEmployeeCache)
    private readonly useremployeeCacheRepo: Repository<UserEmployeeCache>,
    private readonly dataSource: DataSource,
  ) {}

  /* ===============================
   * 🔁 Sync tiempo real (1 usuario)
   * =============================== */
  async syncUser(user: any) {
    const cachedUser = await this.useremployeeCacheRepo.findOne({
      where: { id: user.id },
    });

    const baseData = {
      id: user.id,
      company: user.company, // 🔥 CLAVE PARA CONTEO
      createdAt: user.createdAt,
      updatedAt: user.updatedAt ?? user.createdAt,
    };

    if (!cachedUser) {
      const entity = this.useremployeeCacheRepo.create(baseData);
      await this.useremployeeCacheRepo.save(entity);

      return { message: 'User cached (created)', entity };
    }

    await this.useremployeeCacheRepo.save({
      ...cachedUser,
      ...baseData,
    });

    return { message: 'User cached (updated)' };
  }

  /* =====================================
   * ⏱️ Última fecha de actualización
   * ===================================== */
  async getLastUpdatedAt(): Promise<Date | null> {
    const [record] = await this.useremployeeCacheRepo.find({
      select: ['updatedAt'],
      where: { updatedAt: Not(IsNull()) },
      order: { updatedAt: 'DESC' },
      take: 1,
    });

    return record?.updatedAt ?? null;
  }

  /* =====================================
   * 🔄 Sync masivo (bulk)
   * ===================================== */
  async syncUsersEmployeesBulk(users: any[]) {
    if (!users?.length) return;

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(UserEmployeeCache);

      for (const user of users) {
        const mapped = {
          id: user.id,
          company: user.company,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt ?? user.createdAt,
        };

        const exists = await repo.findOne({
          where: { id: user.id },
        });

        if (!exists) {
          await repo.save(repo.create(mapped));
          continue;
        }

        await repo.save({
          ...exists,
          ...mapped,
        });
      }
    });

    console.log(`✔ Sync usuarios OK | Total: ${users.length}`);
  }

  /* =====================================
   * 📊 Conteo de usuarios por compañía
   * ===================================== */
  async countByCompany(companyId: string): Promise<number> {
    return this.useremployeeCacheRepo.count({
      where: {
        company: { id: companyId },
      },
    });
  }
} 