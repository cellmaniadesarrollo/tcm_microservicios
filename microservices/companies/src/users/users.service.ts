import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { Repository, Not, IsNull, DataSource, In } from 'typeorm';
import { CompanyUser } from './entities/company-user.entity';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(CompanyUser)
        private readonly companyUserRepo: Repository<CompanyUser>,
        private readonly dataSource: DataSource,
 
    ) { } 
    async syncUser(user: any) { 

        // Buscar si ya existe
        let cachedUser = await this.companyUserRepo.findOne({
            where: { id: user.id } 
        });


        // Si NO existe → crear nuevo registro
        if (!cachedUser) {
            cachedUser = this.companyUserRepo.create({
                id: user.id,
                name_user: user.name_user,
                company: user.company,
                createdAt: user.createdAt,
                updatedAt: user.createdAt,
            });

            await this.companyUserRepo.save(cachedUser);
            return { message: 'User cached (created)', cachedUser };
        }

        // SI EXISTE → actualizar datos
        cachedUser.name_user = user.name_user;
        cachedUser.company = user.company;
        cachedUser.updatedAt = user.createdAt;
        cachedUser.updatedAt = user.createdAt;



        await this.companyUserRepo.save(cachedUser);

        return { message: 'User cached (updated)', cachedUser };
    }
    async getLastUpdatedAt(): Promise<Date | null> {
        const [records] = await this.companyUserRepo.find({
            select: ['updatedAt'],
            where: {
                updatedAt: Not(IsNull()),   // ⬅️ evita los NULL
            },
            order: { updatedAt: 'DESC' },
            take: 1
        });
         
        return records?.updatedAt ?? null;
    }
    async syncUsersEmployeesBulk(users: any[]) {
        if (!users || users.length === 0) return;

        await this.dataSource.transaction(async (manager) => {
            const userRepo = manager.getRepository(CompanyUser);

            for (const user of users) {
                const mapped = {
                    id: user.id,
                    name_user: user.name_user,
                    company: user.company,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                };
                // Buscar si existe el usuario
                const existing = await userRepo.findOne({
                    where: { id: mapped.id }
                });

                if (!existing) {
                    // CREAR NUEVO
                    const newUser = userRepo.create(mapped);

                    await userRepo.save(newUser);
                    continue;
                }
                // Actualizar usuario
                await userRepo.save({
                    ...existing,
                    ...mapped,
                });

            }
        });

        console.log(`✔ Sincronización masiva completada (${users.length} usuarios-empleados)`);
    }
}
