import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Fine, FineDocument, FineStatus, FineType } from './schemas/fine.schema';
import { OrderMiniSnapshot, PaymentMiniSnapshot, PrintableType } from '../print/schemas/order-print-status.schema';
import { Model, Types } from 'mongoose';
import { UserSnapshot } from '../orders-relay/schemas/order-replica.schema';
import { InjectModel } from '@nestjs/mongoose';
import { UsersEmployeesEventsService } from '../users-employees-events/users-employees-events.service';
import { UpdateFineStatusDto } from './dto/update-fine-status.dto';
import { GetFinesListDto } from './dto/get-fines-list.dto';
interface CreateFineParams {
    fine_type: FineType;
    entity_type: PrintableType;
    orderId: number;
    paymentId: number | null;
    order: OrderMiniSnapshot;
    payment: PaymentMiniSnapshot | null;
    related_entity_id: Types.ObjectId;
    finedTo: UserSnapshot;
    appliedBy?: UserSnapshot | null;
    amount?: number;
    observation?: string | null;
}

interface GetEmployeesFinesSummaryParams {
    companyId: string;
    startDate: Date;
    endDate: Date;
    status?: FineStatus;
    page?: number;
    limit?: number;
}
// Transiciones permitidas (ajusta a tu lógica de negocio real)
const ALLOWED_TRANSITIONS: Record<FineStatus, FineStatus[]> = {
    [FineStatus.PENDING]: [FineStatus.CHARGED, FineStatus.WAIVED, FineStatus.CANCELLED],
    [FineStatus.CHARGED]: [FineStatus.PAID, FineStatus.CANCELLED],
    [FineStatus.PAID]: [],
    [FineStatus.WAIVED]: [],
    [FineStatus.CANCELLED]: [],
};
@Injectable()
export class FinesService {
    constructor(
        @InjectModel(Fine.name)
        private readonly fineModel: Model<FineDocument>,
        private readonly usersEmployeesEventsService: UsersEmployeesEventsService,

    ) { }
    async createFine(params: CreateFineParams): Promise<FineDocument> {
        try {
            const now = new Date();

            return await this.fineModel.create({
                fine_type: params.fine_type,
                entity_type: params.entity_type,
                orderId: params.orderId,
                paymentId: params.paymentId,
                order: params.order,
                payment: params.payment,
                related_entity_type: 'PRINT_LOG',
                related_entity_id: params.related_entity_id,
                amount: params.amount ?? 0.25,
                currency: 'USD',
                status: FineStatus.PENDING,
                finedTo: params.finedTo,
                appliedBy: params.appliedBy ?? null,
                observation: params.observation ?? null,
                statusHistory: [
                    {
                        id: 1,
                        fromStatus: null,
                        toStatus: FineStatus.PENDING,
                        changedBy: params.appliedBy ?? params.finedTo,
                        reason: 'Multa generada automáticamente por impresión de copia adicional',
                        changed_at: now,
                    },
                ],
            });
        } catch (error) {
            console.error(error);

            if (error instanceof RpcException) {
                throw error;
            }

            throw new RpcException(
                new InternalServerErrorException('Error interno al crear la multa por copia'),
            );
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Listado de empleados + resumen de multas en rango de fechas
    // ─────────────────────────────────────────────────────────────
    async getEmployeesFinesSummary(params: GetEmployeesFinesSummaryParams) {
        try {
            const { companyId, startDate, endDate, status } = params;
            const page = params.page ?? 1;
            const limit = params.limit ?? 20;

            // 1. Página de empleados de la compañía (viene de otro módulo)
            const employeesPage = await this.usersEmployeesEventsService.findEmployeesByCompany(
                companyId,
                page,
                limit,
            );

            const employeeIds = employeesPage.data.map((e) => e.id);

            if (!employeeIds.length) {
                return {
                    data: [],
                    pagination: employeesPage.pagination,
                };
            }

            // 2. Aggregate de multas agrupadas por finedTo.id
            const match: any = {
                'finedTo.id': { $in: employeeIds },
                createdAt: { $gte: startDate, $lte: endDate },
            };

            if (status) {
                match.status = status;
            }

            const finesAgg = await this.fineModel.aggregate([
                { $match: match },
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: '$finedTo.id',
                        totalAmount: { $sum: '$amount' },
                        totalCount: { $sum: 1 },
                        fines: { $push: '$$ROOT' },
                    },
                },
            ]);

            const finesByUserId = new Map(finesAgg.map((f) => [f._id, f]));

            // 3. Merge: cada empleado + su resumen (0 si no tiene multas)
            const data = employeesPage.data.map((employee) => {
                const summary = finesByUserId.get(employee.id);
                return {
                    employee,
                    totalAmount: summary?.totalAmount ?? 0,
                    totalCount: summary?.totalCount ?? 0,
                    fines: summary?.fines ?? [],
                };
            });

            return {
                data,
                pagination: employeesPage.pagination,
            };
        } catch (error) {
            console.error(error);

            if (error instanceof RpcException) {
                throw error;
            }

            throw new RpcException(
                new InternalServerErrorException('Error interno al obtener el resumen de multas por empleado'),
            );
        }
    }
    async updateFineStatus(
        user: { userId: string; companyId: string; branchId: string },
        dto: UpdateFineStatusDto,
    ) {
        try {
            const fine = await this.fineModel.findById(dto.fineId);
            if (!fine) {
                throw new RpcException(new NotFoundException(`Multa ${dto.fineId} no encontrada`));
            }

            const fromStatus = fine.status;

            if (fromStatus === dto.toStatus) {
                throw new RpcException(
                    new BadRequestException(`La multa ya se encuentra en estado ${dto.toStatus}`),
                );
            }

            const allowedNext = ALLOWED_TRANSITIONS[fromStatus] ?? [];
            if (!allowedNext.includes(dto.toStatus)) {
                throw new RpcException(
                    new BadRequestException(`No se puede pasar de ${fromStatus} a ${dto.toStatus}`),
                );
            }

            const changedBy = await this.buildUserSnapshot(user.userId);
            const now = new Date();
            const nextId = (fine.statusHistory?.length ?? 0) + 1;

            fine.status = dto.toStatus;
            fine.statusHistory.push({
                id: nextId,
                fromStatus,
                toStatus: dto.toStatus,
                changedBy,
                reason: dto.reason ?? null,
                changed_at: now,
            });

            if (dto.toStatus === FineStatus.CHARGED) {
                fine.charged_at = now;
            }

            if (dto.payment_reference) {
                fine.payment_reference = dto.payment_reference;
            }

            await fine.save();

            return fine;
        } catch (error) {
            console.error(error);

            if (error instanceof RpcException) {
                throw error;
            }

            throw new RpcException(
                new InternalServerErrorException('Error interno al actualizar el estado de la multa'),
            );
        }
    }
    private async buildUserSnapshot(userId: string): Promise<UserSnapshot> {
        try {
            // Ajustar nombre del método según UsersEmployeesEventsService real
            const cached = await this.usersEmployeesEventsService.findUserByI(userId);

            if (!cached) {
                throw new RpcException(new NotFoundException(`Usuario ${userId} no encontrado`));
            }

            return {
                id: cached.id,
                username: cached.username,
                first_name: cached.first_name,
                last_name: cached.last_name,
                dni: cached.dni ?? undefined,
                email: cached.email,
                phone: cached.phone,
            };
        } catch (error) {
            if (error instanceof RpcException) {
                throw error;
            }

            throw new RpcException(
                new InternalServerErrorException('Error interno al obtener datos del usuario'),
            );
        }
    }



    private resolveDateRange(dto: GetFinesListDto): { start: Date; end: Date } {
        if (dto.periodMode === 'preset') {
            if (!dto.presetPeriod) {
                throw new RpcException(
                    new BadRequestException('presetPeriod es requerido cuando periodMode es "preset"'),
                );
            }
            const [year, month] = dto.presetPeriod.split('-').map(Number);
            const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
            const end = new Date(year, month, 0, 23, 59, 59, 999); // último día del mes
            return { start, end };
        }

        // custom
        if (!dto.dateFrom || !dto.dateTo) {
            throw new RpcException(
                new BadRequestException('dateFrom y dateTo son requeridos cuando periodMode es "custom"'),
            );
        }
        const start = new Date(dto.dateFrom);
        const end = new Date(dto.dateTo);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    // ── Listado plano de multas + totales ──────────────────────────
    async getFinesList(companyId: string, dto: GetFinesListDto) {
        try {
            const { start, end } = this.resolveDateRange(dto);
            const page = dto.page ?? 1;
            const limit = dto.limit ?? 20;
            const skip = (page - 1) * limit;

            // Scoping por compañía: solo multas de empleados de esta compañía
            const companyEmployeeIds = await this.usersEmployeesEventsService.findAllEmployeeIdsByCompany(companyId);

            if (!companyEmployeeIds.length) {
                return {
                    data: [],
                    totals: { totalAmount: 0, totalCount: 0, byStatus: {} },
                    pagination: { page, limit, total: 0, totalPages: 1 },
                };
            }

            let finedToIdFilter: any = { $in: companyEmployeeIds };

            if (dto.employeeId) {
                if (!companyEmployeeIds.includes(dto.employeeId)) {
                    throw new RpcException(
                        new ForbiddenException('El empleado indicado no pertenece a esta compañía'),
                    );
                }
                finedToIdFilter = dto.employeeId;
            }

            const match: any = {
                'finedTo.id': finedToIdFilter,
                createdAt: { $gte: start, $lte: end },
            };

            if (dto.status) {
                match.status = dto.status;
            }

            const [result] = await this.fineModel.aggregate([
                { $match: match },
                {
                    $facet: {
                        data: [
                            { $sort: { createdAt: -1 } },
                            { $skip: skip },
                            { $limit: limit },
                        ],
                        totals: [
                            {
                                $group: {
                                    _id: null,
                                    totalAmount: { $sum: '$amount' },
                                    totalCount: { $sum: 1 },
                                },
                            },
                        ],
                        byStatus: [
                            {
                                $group: {
                                    _id: '$status',
                                    totalAmount: { $sum: '$amount' },
                                    totalCount: { $sum: 1 },
                                },
                            },
                        ],
                        totalMatched: [{ $count: 'count' }],
                    },
                },
            ]);

            const totals = result.totals[0] ?? { totalAmount: 0, totalCount: 0 };
            const byStatus: Record<string, { totalAmount: number; totalCount: number }> = {};
            for (const entry of result.byStatus) {
                byStatus[entry._id] = { totalAmount: entry.totalAmount, totalCount: entry.totalCount };
            }
            const total = result.totalMatched[0]?.count ?? 0;

            return {
                data: result.data,
                totals: {
                    totalAmount: totals.totalAmount,
                    totalCount: totals.totalCount,
                    byStatus,
                },
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit) || 1,
                },
            };
        } catch (error) {
            console.error(error);

            if (error instanceof RpcException) {
                throw error;
            }

            throw new RpcException(
                new InternalServerErrorException('Error interno al listar multas'),
            );
        }
    }

    // ── Listado liviano de empleados para el select del filtro ─────
    async getEmployeesForFilter(companyId: string) {
        try {
            return await this.usersEmployeesEventsService.findEmployeesLite(companyId);
        } catch (error) {
            console.error(error);

            if (error instanceof RpcException) {
                throw error;
            }

            throw new RpcException(
                new InternalServerErrorException('Error interno al listar empleados para el filtro'),
            );
        }
    }

    async getFineDetail(companyId: string, fineId: string) {
        try {
            const fine = await this.fineModel.findById(fineId).lean();

            if (!fine) {
                throw new RpcException(new NotFoundException(`Multa ${fineId} no encontrada`));
            }

            // Scoping por compañía: evita que un usuario de otra compañía vea la multa por id directo
            const companyEmployeeIds = await this.usersEmployeesEventsService.findAllEmployeeIdsByCompany(companyId);
            if (!companyEmployeeIds.includes(fine.finedTo.id)) {
                throw new RpcException(new NotFoundException(`Multa ${fineId} no encontrada`));
            }

            return fine;
        } catch (error) {
            console.error(error);

            if (error instanceof RpcException) {
                throw error;
            }

            throw new RpcException(
                new InternalServerErrorException('Error interno al obtener el detalle de la multa'),
            );
        }
    }
}