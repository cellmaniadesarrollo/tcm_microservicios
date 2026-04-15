import { Injectable } from '@nestjs/common';
import { UserEmployeeCache } from './entities/user_employee_cache.entity';
import { GroupCache } from './entities/group_cache.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, DataSource, In } from 'typeorm';
import { ORDER_TYPE_GROUPS } from './constants/order-type-groups.map';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class UsersEmployeesEventsService {
    constructor(
        @InjectRepository(UserEmployeeCache)
        private readonly useremployeeCacheRepo: Repository<UserEmployeeCache>,

        @InjectRepository(GroupCache)
        private readonly groupCacheRepo: Repository<GroupCache>,
        private readonly dataSource: DataSource,
    ) { }
    async syncUser(user: any) {
        // console.log(user);

        const isCompanyAdmin = !user.employee;

        const fullFirstName = isCompanyAdmin
            ? user.name_user
            : [user.employee.first_name1, user.employee.first_name2]
                .filter(Boolean)
                .join(' ');

        const fullLastName = isCompanyAdmin
            ? ''
            : [user.employee.last_name1, user.employee.last_name2]
                .filter(Boolean)
                .join(' ');

        let cachedUser = await this.useremployeeCacheRepo.findOne({
            where: { id: user.id },
            relations: ['groups'],
        });

        const groupsCache = user.userGroups.map((ug: any) =>
            this.groupCacheRepo.create({
                id: ug.id,
                group_name: ug.group.name,
                employee: { id: user.id },
            }),
        );

        const baseData = {
            id: user.id,
            username: user.name_user,
            first_name: fullFirstName,
            last_name: fullLastName,
            dni: isCompanyAdmin ? null : user.employee.dni,
            email: isCompanyAdmin ? user.email_user : user.employee.email_business,
            phone: isCompanyAdmin ? '' : user.employee.phone_business,
            company: user.company, // 🔥 CLAVE
            updatedAt: user.updatedAt ?? user.createdAt,
        };

        if (!cachedUser) {
            cachedUser = this.useremployeeCacheRepo.create({
                ...baseData,
                groups: groupsCache,
                createdAt: user.createdAt,
            });

            await this.useremployeeCacheRepo.save(cachedUser);
            return { message: 'User cached (created)', cachedUser };
        }

        // Actualización
        await this.groupCacheRepo
            .createQueryBuilder()
            .delete()
            .where('employeeId = :id', { id: cachedUser.id })
            .execute();

        cachedUser.groups = groupsCache;
        Object.assign(cachedUser, baseData);

        await this.useremployeeCacheRepo.save(cachedUser);

        return { message: 'User cached (updated)', cachedUser };
    }


    async getLastUpdatedAt(): Promise<Date | null> {
        const [records] = await this.useremployeeCacheRepo.find({
            select: ['updatedAt'],
            where: {
                updatedAt: Not(IsNull()),   // ⬅️ evita los NULL
            },
            order: { updatedAt: 'DESC' },
            take: 1
        });
        return records?.updatedAt ?? null;
    }
    /**
     * Sincroniza de forma masiva los usuarios-empleados recibidos desde otro
     * microservicio. Crea o actualiza el usuario en caché y sus grupos asociados,
     * eliminando los grupos que ya no existan.
     *
     * ✔ Soporta empleados normales
     * ✔ Soporta administrador de compañía (employee === null)
     * ✔ Mantiene consistencia multi-tenant (company_id)
     * ✔ Ejecuta todo en una sola transacción
     */
    async syncUsersEmployeesBulk(users: any[]) {
        if (!users || users.length === 0) return;

        await this.dataSource.transaction(async (manager) => {
            const userRepo = manager.getRepository(UserEmployeeCache);
            const groupRepo = manager.getRepository(GroupCache);

            for (const user of users) {

                // 🧠 Detectar tipo de usuario
                const isCompanyAdmin = !user.employee;

                // 🧩 Construcción segura de nombres
                const fullFirstName = isCompanyAdmin
                    ? user.name_user
                    : [
                        user.employee?.first_name1,
                        user.employee?.first_name2,
                    ].filter(Boolean).join(' ');

                const fullLastName = isCompanyAdmin
                    ? ''
                    : [
                        user.employee?.last_name1,
                        user.employee?.last_name2,
                    ].filter(Boolean).join(' ');

                // 🧱 Mapeo unificado (admin + empleado)
                const mapped = {
                    id: user.id,
                    username: user.name_user,
                    first_name: fullFirstName,
                    last_name: fullLastName,
                    dni: isCompanyAdmin ? null : user.employee?.dni ?? null,
                    email: isCompanyAdmin
                        ? user.email_user
                        : user.employee?.email_business ?? user.email_user,
                    phone: isCompanyAdmin ? '' : user.employee?.phone_business ?? '',
                    company: user.company,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                };

                // 🧩 Grupos entrantes
                const incomingGroupIds =
                    user.userGroups?.map((ug) => ug.id) ?? [];

                const incomingGroups =
                    user.userGroups?.map((ug) => ({
                        id: ug.id,
                        group_name: ug.group.name,
                    })) ?? [];

                // 🔎 Buscar usuario existente
                const existing = await userRepo.findOne({
                    where: { id: mapped.id },
                    relations: ['groups'],
                });

                // 🆕 CREAR
                if (!existing) {
                    const newUser = userRepo.create(mapped);
                    await userRepo.save(newUser);

                    for (const g of incomingGroups) {
                        await groupRepo.save(
                            groupRepo.create({
                                ...g,
                                employee: newUser,
                            }),
                        );
                    }

                    continue;
                }

                // ✏️ ACTUALIZAR USUARIO
                await userRepo.save({
                    ...existing,
                    ...mapped,
                });

                const existingGroupIds =
                    existing.groups?.map((g) => g.id) ?? [];

                // 🗑️ Eliminar grupos que ya no existen
                const toDelete = existingGroupIds.filter(
                    (id) => !incomingGroupIds.includes(id),
                );

                if (toDelete.length > 0) {
                    await groupRepo.delete({ id: In(toDelete) });
                }

                // ➕ Insertar / actualizar grupos
                for (const g of incomingGroups) {
                    const exists = existing.groups.find((eg) => eg.id === g.id);

                    if (!exists) {
                        await groupRepo.save(
                            groupRepo.create({
                                ...g,
                                employee: existing,
                            }),
                        );
                    } else if (exists.group_name !== g.group_name) {
                        exists.group_name = g.group_name;
                        await groupRepo.save(exists);
                    }
                }
            }
        });

        console.log(
            `✔ Sincronización masiva completada (${users.length} usuarios-empleados)`,
        );
    }



    async findTechniciansByOrderType(user: any, orderTypeId: number) {
        const groupNames = ORDER_TYPE_GROUPS[orderTypeId];

        if (!groupNames?.length) {
            throw new RpcException(
                `No hay grupos configurados para el tipo de orden: ${orderTypeId}`,
            );
        }

        return await this.useremployeeCacheRepo
            .createQueryBuilder('employee')
            .innerJoin('employee.groups', 'group')
            .where('employee.company_id = :companyId', { companyId: user.companyId })
            .andWhere('group.group_name IN (:...groupNames)', { groupNames }) // 👈 soporta array
            .select([
                'employee.id AS id',
                `CONCAT(employee.first_name, ' ', employee.last_name) AS name`,
            ])
            .getRawMany();
    }

    async getUsernameById(userId: string, companyId: string): Promise<string | null> {
        const user = await this.useremployeeCacheRepo
            .createQueryBuilder('user')
            .select('user.username') // Solo pedimos la columna exacta
            .where('user.id = :userId', { userId })
            .andWhere('user.company_id = :companyId', { companyId })
            .getOne();

        return user?.username || null;
    }
} 