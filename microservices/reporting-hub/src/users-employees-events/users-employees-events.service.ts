import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RpcException } from '@nestjs/microservices';
import {
    UserEmployeeCache,
    UserEmployeeCacheDocument,
} from './schemas/user-employee-cache.schema';
import { ORDER_TYPE_GROUPS } from './constants/order-type-groups.map';

@Injectable()
export class UsersEmployeesEventsService {
    constructor(
        @InjectModel(UserEmployeeCache.name)
        private readonly userModel: Model<UserEmployeeCacheDocument>,
    ) { }

    // ── Sync individual (Kafka events) ─────────────────────────────────────────
    async syncUser(user: any): Promise<void> {
        const mapped = this.mapUser(user);

        await this.userModel.findOneAndUpdate(
            { id: user.id },
            { $set: mapped },
            { upsert: true, returnDocument: 'after' },
        );
    }

    // ── Última fecha de actualización (sync incremental) ───────────────────────
    async getLastUpdatedAt(): Promise<Date | null> {
        const result = await this.userModel
            .findOne({ updatedAt: { $ne: null } })
            .sort({ updatedAt: -1 })
            .select('updatedAt')
            .lean();

        return result?.updatedAt ?? null;
    }

    // ── Sync masiva: inicial o incremental ─────────────────────────────────────
    async syncUsersEmployeesBulk(users: any[]): Promise<void> {
        if (!users?.length) return;

        const operations = users.map((user) => ({
            updateOne: {
                filter: { id: user.id },
                update: { $set: this.mapUser(user) },
                upsert: true,
            },
        }));

        // ordered: false → continúa aunque algún doc falle
        const result = await this.userModel.bulkWrite(operations, { ordered: false });

        console.log(
            `✔ Sync masiva OK | Upserted: ${result.upsertedCount} | Modified: ${result.modifiedCount}`,
        );
    }

    // ── Técnicos por tipo de orden ─────────────────────────────────────────────
    async findTechniciansByOrderType(user: any, orderTypeId: number) {
        const groupNames = ORDER_TYPE_GROUPS[orderTypeId];

        if (!groupNames?.length) {
            throw new RpcException(
                `No hay grupos configurados para el tipo de orden: ${orderTypeId}`,
            );
        }

        const results = await this.userModel
            .find({
                companyId: user.companyId,
                'groups.group_name': { $in: groupNames },
            })
            .select('id first_name last_name')
            .lean();

        return results.map((emp) => ({
            id: emp.id,
            name: `${emp.first_name} ${emp.last_name}`.trim(),
        }));
    }

    // ── Username por ID ────────────────────────────────────────────────────────
    async getUsernameById(userId: string, companyId: string): Promise<string | null> {
        const user = await this.userModel
            .findOne({ id: userId, companyId })
            .select('username')
            .lean();

        return user?.username ?? null;
    }

    // ── Helper: normaliza el payload entrante ──────────────────────────────────
    private mapUser(user: any) {
        const isCompanyAdmin = !user.employee;

        const first_name = isCompanyAdmin
            ? user.name_user
            : [user.employee?.first_name1, user.employee?.first_name2]
                .filter(Boolean)
                .join(' ');

        const last_name = isCompanyAdmin
            ? ''
            : [user.employee?.last_name1, user.employee?.last_name2]
                .filter(Boolean)
                .join(' ');

        const groups = (user.userGroups ?? []).map((ug: any) => ({
            id: ug.id,
            group_name: ug.group.name,
        }));

        return {
            id: user.id,
            username: user.name_user,
            first_name,
            last_name,
            dni: isCompanyAdmin ? null : (user.employee?.dni ?? null),
            email: isCompanyAdmin ? user.email_user : (user.employee?.email_business ?? user.email_user),
            phone: isCompanyAdmin ? '' : (user.employee?.phone_business ?? ''),
            companyId: user.company?.id ?? user.company,   // acepta objeto o string
            groups,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt ?? user.createdAt,
        };
    }
    /**
 * Busca un usuario/empleado en la caché por su UUID de negocio (campo `id`).
 */
    async findUserByI(userId: string): Promise<UserEmployeeCacheDocument> {
        try {
            const user = await this.userModel.findOne({ id: userId }).exec();

            if (!user) {
                throw new RpcException(
                    new NotFoundException(`Usuario ${userId} no encontrado en la caché`),
                );
            }

            return user;
        } catch (error) {
            if (error instanceof RpcException) {
                throw error;
            }

            throw new RpcException(
                new InternalServerErrorException('Error interno al obtener datos del usuario'),
            );
        }
    }

    // users-employees-events/users-employees-events.service.ts
    async findEmployeesByCompany(
        companyId: string,
        page = 1,
        limit = 20,
    ): Promise<{
        data: UserEmployeeCacheDocument[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
    }> {
        try {
            const skip = (page - 1) * limit;
            const filter = { companyId };

            const [items, total] = await Promise.all([
                this.userModel
                    .find(filter)
                    .sort({ first_name: 1, last_name: 1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                this.userModel.countDocuments(filter),
            ]);

            return {
                data: items,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit) || 1,
                },
            };
        } catch (error) {
            console.error(error);
            throw new RpcException(
                new InternalServerErrorException('Error interno al listar empleados de la compañía'),
            );
        }
    }
    async findAllEmployeeIdsByCompany(companyId: string): Promise<string[]> {
        try {
            const users = await this.userModel.find({ companyId }).select('id').lean();
            return users.map((u) => u.id);
        } catch (error) {
            console.error(error);
            throw new RpcException(
                new InternalServerErrorException('Error interno al listar ids de empleados'),
            );
        }
    }

    /** Listado liviano para selects/dropdowns del front (sin paginación) */
    async findEmployeesLite(companyId: string): Promise<{ id: string; first_name: string; last_name: string; username: string }[]> {
        try {
            return await this.userModel
                .find({ companyId })
                .select('id first_name last_name username')
                .sort({ first_name: 1, last_name: 1 })
                .lean();
        } catch (error) {
            console.error(error);
            throw new RpcException(
                new InternalServerErrorException('Error interno al listar empleados'),
            );
        }
    }
}