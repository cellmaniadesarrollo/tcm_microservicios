import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { OrderStatus, OrderStatusDocument } from '../orders-relay/schemas/order-status.schema';
import { OrderType, OrderTypeDocument } from '../orders-relay/schemas/order-type.schema';
import { CompanyReplica, CompanyReplicaDocument } from '../companies/schemas/company-replica.schema';
import { UserEmployeeCache, UserEmployeeCacheDocument } from '../users-employees-events/schemas/user-employee-cache.schema';
import { GetOrdersFilterDto } from './dto/order-filters-metadata.dto';
import { OrderReplica, OrderReplicaDocument } from '../orders-relay/schemas/order-replica.schema';
import { OrderListItemDto } from './dto/order-metadata.dto';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class OrdersReportsService {
    constructor(
        @InjectModel(OrderStatus.name)
        private orderStatusModel: Model<OrderStatusDocument>,

        @InjectModel(OrderType.name)
        private orderTypeModel: Model<OrderTypeDocument>,

        @InjectModel(CompanyReplica.name)
        private companyReplicaModel: Model<CompanyReplicaDocument>,

        @InjectModel(UserEmployeeCache.name)
        private userEmployeeCacheModel: Model<UserEmployeeCacheDocument>,
        @InjectModel(OrderReplica.name)
        private orderReplicaModel: Model<OrderReplicaDocument>,
    ) { }

    async getOrderFiltersMetadata(companyId: string) {
        const [statuses, types, company, employees] = await Promise.all([
            this.orderStatusModel.find().select('id name').sort({ id: 1 }).lean(),

            this.orderTypeModel.find().select('id name').sort({ id: 1 }).lean(),

            this.companyReplicaModel
                .findOne({ id: companyId })
                .select('branches')
                .lean(),

            this.userEmployeeCacheModel
                .find({ companyId })
                .select('id first_name last_name username groups')
                .lean(),
        ]);

        const branches = company?.branches || [];

        // Filtrar técnicos y cajeros (ajusta los nombres exactos de tus grupos)
        const technicians = employees.filter(emp =>
            emp.groups.some(group =>
                ['TECHNICIANS', 'CSRSPER'].includes(group.group_name.toUpperCase())  // mejor usar toUpperCase()
            )
        );

        const cashiers = employees.filter(emp =>
            emp.groups.some(group =>
                ['CASHIERS'].includes(group.group_name.toUpperCase())
            )
        );

        return {
            orderStatuses: statuses.map(s => ({
                id: s.id,
                name: s.name,
            })),

            orderTypes: types.map(t => ({
                id: t.id,
                name: t.name,
            })),

            branches: branches.map(b => ({
                id: b.id,
                name: b.name,
            })),

            technicians: technicians.map(t => ({
                id: t.id,
                name: `${t.first_name} ${t.last_name}`.trim() || t.username,
            })),

            cashiers: cashiers.map(c => ({
                id: c.id,
                name: `${c.first_name} ${c.last_name}`.trim() || c.username,
            })),
        };
    }
    // ─── LA FUNCIÓN  ───────────────────────────────
    // ─── Servicio ─────────────────────────────────────────────────────────────────
    async getOrdersList(companyId: string, dto: GetOrdersFilterDto): Promise<{
        data: OrderListItemDto[];
        total: number;
    }> {
        const filter = this.buildMongoFilter(companyId, dto);

        const [raw, total] = await Promise.all([
            this.orderReplicaModel
                .find(filter)
                .select({
                    id: 1,
                    order_number: 1,
                    revisadoAntes: 1,
                    currentStatus: 1,
                    type: 1,
                    branch: 1,
                    customer: 1,
                    device: 1,
                    technicians: 1,
                    entry_date: 1,
                    estimated_price: 1,
                    // necesarios para calcular los 4 campos derivados
                    statusHistory: 1,
                    findings: 1,
                    payments: 1,
                })
                .sort({ entry_date: -1 })
                .lean(),

            this.orderReplicaModel.countDocuments(filter),
        ]);

        const now = new Date();
        const data = raw.map((order): OrderListItemDto => {

            // ── 1. Fecha completado ───────────────────────────────────
            // Última vez que la orden llegó al estado ENTREGADA (id = 8)
            const completedAt = order.statusHistory
                ?.filter(h => h.toStatus?.id === 8)
                .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
            [0]?.changed_at ?? null;

            // ── 2. Costos de procedimientos ───────────────────────────
            const totalProceduresCost = order.findings?.reduce((sumF, finding) =>
                sumF + (finding.procedures?.reduce((sumP, proc) =>
                    sumP + (proc.is_active ? (proc.procedure_cost ?? 0) : 0),
                    0) ?? 0),
                0) ?? 0;

            // ── 3. Total pagado (solo INGRESO) ────────────────────────
            const totalPaid = order.payments?.reduce((sum, p) =>
                sum + (p.flow_type === 'INGRESO' ? (p.amount ?? 0) : 0),
                0) ?? 0;

            // ── 4. Resumen de hallazgos ───────────────────────────────
            const activeFindings = order.findings?.filter(f => f.is_active) ?? [];
            const findingsSummary = {
                total: activeFindings.length,
                resolved: activeFindings.filter(f => f.is_resolved).length,
                pending: activeFindings.filter(f => !f.is_resolved).length,
            };

            // ── 5. Garantía activa ────────────────────────────────────
            // Al menos un procedimiento activo con warranty_days > 0
            // cuya fecha de vencimiento (completedAt + warranty_days) aún no pasó.
            // Si la orden no fue entregada aún, se considera garantía "pendiente de activar" → true
            const hasActiveWarranty = order.findings?.some(finding =>
                finding.procedures?.some(proc => {
                    if (!proc.is_active || !proc.warranty_days || proc.warranty_days <= 0) return false;
                    if (!completedAt) return true; // entregada aún no → garantía existe pero no ha iniciado
                    const expiresAt = new Date(completedAt);
                    expiresAt.setDate(expiresAt.getDate() + proc.warranty_days);
                    return expiresAt > now;
                }),
            ) ?? false;

            // ── Mapeo limpio de device ────────────────────────────────
            const device = order.device ? {
                model: order.device.model?.models_name,
                brand: order.device.model?.brand_name,
                type: order.device.type?.name,
            } : undefined;

            return {
                id: order.id,
                order_number: order.order_number,
                revisadoAntes: order.revisadoAntes,
                currentStatus: order.currentStatus,
                type: order.type,
                branch: { id: order.branch.id, name: order.branch.name },
                customer: { id: order.customer.id, firstName: order.customer.firstName, lastName: order.customer.lastName },
                device,
                technicians: order.technicians?.map(t => ({ id: t.id, first_name: t.first_name, last_name: t.last_name })) ?? [],
                entry_date: order.entry_date,
                completed_at: completedAt,
                estimated_price: order.estimated_price ?? null,
                total_procedures_cost: totalProceduresCost,
                total_paid: totalPaid,
                findings_summary: findingsSummary,
                has_active_warranty: hasActiveWarranty,
            };
        });

        return { data, total };
    }
    // ─── Construcción del filtro Mongo desde el DTO del frontend ─────────────

    buildMongoFilter(companyId: string, dto: GetOrdersFilterDto): Record<string, any> {

        const filter: Record<string, any> = { 'company.id': companyId };

        // Arrays de IDs → $in  (el frontend manda strings; cast a Number para catalogs)
        if (dto.status?.length)
            filter['currentStatus.id'] = { $in: dto.status.map(Number) };

        if (dto.orderType?.length)
            filter['type.id'] = { $in: dto.orderType.map(Number) };

        if (dto.branch?.length)
            filter['branch.id'] = { $in: dto.branch };          // UUID → string

        if (dto.technician?.length)
            filter['technicians.id'] = { $in: dto.technician }; // UUID → string

        if (dto.receptionist?.length)
            filter['createdBy.id'] = { $in: dto.receptionist }; // UUID → string

        // ── Período ──────────────────────────────────────────────────────────────
        if (dto.periodMode === 'preset' && dto.presetPeriod) {
            // "2026-04" → primer y último instante del mes
            const [year, month] = dto.presetPeriod.split('-').map(Number);
            filter['entry_date'] = {
                $gte: new Date(year, month - 1, 1),
                $lt: new Date(year, month, 1),   // primer día del mes siguiente
            };
        } else if (dto.periodMode === 'custom') {
            const dateFilter: Record<string, Date> = {};
            if (dto.dateFrom) dateFilter.$gte = new Date(dto.dateFrom);
            if (dto.dateTo) {
                const to = new Date(dto.dateTo);
                to.setHours(23, 59, 59, 999);     // incluir todo el día final
                dateFilter.$lte = to;
            }
            if (Object.keys(dateFilter).length) filter['entry_date'] = dateFilter;
        }

        return filter;
    }
    async getOrderDetail(companyId: string, orderId: number) {
        const order = await this.orderReplicaModel
            .findOne({
                id: orderId,
                'company.id': companyId,
            })
            .lean();

        if (!order) throw new RpcException({ statusCode: 404, message: 'Orden no encontrada' });

        return order;
    }


    // orders-reports.service.ts  — agregar método

    async getDashboard(companyId: string, userId: string, groups: string[]): Promise<any> {

        const isAdmin = groups.some(g => ['COMPANY_ADMIN', 'ADMINS', 'IFE'].includes(g));
        const isTechnician = groups.some(g => ['TECHNICIANS', 'CSRSPER'].includes(g));
        const isCashier = groups.includes('CASHIERS');

        const [technician, cashier, admin] = await Promise.all([
            isTechnician ? this.getTechnicianDashboard(companyId, userId) : Promise.resolve(undefined),
            isCashier ? this.getCashierDashboard(companyId) : Promise.resolve(undefined),
            isAdmin ? this.getAdminDashboard(companyId) : Promise.resolve(undefined),
        ]);

        return { groups, technician, cashier, admin };
    }

    // ── TECHNICIAN ────────────────────────────────────────────────────────────────
    private async getTechnicianDashboard(companyId: string, userId: string): Promise<any> {
        const RESOLVED_IDS = [7, 8]; // TRABAJO_FINALIZADO, ENTREGADA

        const [byStatus, byBranch] = await Promise.all([

            // Conteo por estado
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, 'technicians.id': userId } },
                { $group: { _id: '$currentStatus.name', count: { $sum: 1 } } },
                { $project: { _id: 0, name: '$_id', count: 1 } },
                { $sort: { count: -1 } },
            ]),

            // Conteo por sucursal con resolved
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, 'technicians.id': userId } },
                {
                    $group: {
                        _id: '$branch.name',
                        total: { $sum: 1 },
                        resolved: {
                            $sum: {
                                $cond: [{ $in: ['$currentStatus.id', RESOLVED_IDS] }, 1, 0]
                            }
                        },
                    },
                },
                { $project: { _id: 0, name: '$_id', total: 1, resolved: 1 } },
                { $sort: { total: -1 } },
            ]),
        ]);

        const totalAssigned = byStatus.reduce((s, r) => s + r.count, 0);
        const totalResolved = byBranch.reduce((s, r) => s + r.resolved, 0);

        return {
            totalAssigned,
            totalResolved,
            totalPending: totalAssigned - totalResolved,
            byStatus,
            byBranch,
        };
    }

    // ── CASHIERS ──────────────────────────────────────────────────────────────────
    private async getCashierDashboard(companyId: string): Promise<any> {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart.getTime() + 86_400_000);

        // Lunes y domingo de la semana anterior
        const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1=lun … 7=dom
        const lastMonday = new Date(todayStart);
        lastMonday.setDate(todayStart.getDate() - dayOfWeek - 6);
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 7);

        const [todayData, lastWeekData] = await Promise.all([

            // Hoy
            this.orderReplicaModel.aggregate([
                {
                    $match: {
                        'company.id': companyId,
                        entry_date: { $gte: todayStart, $lt: todayEnd },
                    },
                },
                {
                    $group: {
                        _id: null,
                        ingresadas: { $sum: 1 },
                        entregadas: {
                            $sum: { $cond: [{ $eq: ['$currentStatus.id', 8] }, 1, 0] }
                        },
                    },
                },
            ]),

            // Semana anterior día a día
            this.orderReplicaModel.aggregate([
                {
                    $match: {
                        'company.id': companyId,
                        entry_date: { $gte: lastMonday, $lt: lastSunday },
                    },
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$entry_date', timezone: 'America/Guayaquil' }
                        },
                        ingresadas: { $sum: 1 },
                        entregadas: {
                            $sum: { $cond: [{ $eq: ['$currentStatus.id', 8] }, 1, 0] }
                        },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
        ]);

        // Rellenar los 7 días aunque no tengan datos
        const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const byDay = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(lastMonday);
            d.setDate(lastMonday.getDate() + i);
            const key = d.toISOString().split('T')[0];
            const found = lastWeekData.find((r: any) => r._id === key);
            return {
                date: key,
                dayName: DAY_NAMES[d.getDay()],
                ingresadas: found?.ingresadas ?? 0,
                entregadas: found?.entregadas ?? 0,
            };
        });

        return {
            today: {
                ingresadas: todayData[0]?.ingresadas ?? 0,
                entregadas: todayData[0]?.entregadas ?? 0,
            },
            lastWeek: {
                ingresadas: byDay.reduce((s, d) => s + d.ingresadas, 0),
                entregadas: byDay.reduce((s, d) => s + d.entregadas, 0),
                byDay,
            },
        };
    }

    // ── ADMIN / OWNER / IFE ───────────────────────────────────────────────────────
    private async getAdminDashboard(companyId: string): Promise<any> {

        // Últimas 4 semanas para la tendencia
        const since = new Date();
        since.setDate(since.getDate() - 28);

        const [byStatus, financeData, byBranch, byTechnician, weeklyTrend] = await Promise.all([

            // Por estado
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                {
                    $group: {
                        _id: { id: '$currentStatus.id', name: '$currentStatus.name' },
                        count: { $sum: 1 },
                    },
                },
                { $project: { _id: 0, id: '$_id.id', name: '$_id.name', count: 1 } },
                { $sort: { id: 1 } },
            ]),

            // Finanzas: costo de procedimientos + pagos
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                { $unwind: { path: '$findings', preserveNullAndEmptyArrays: true } },
                { $unwind: { path: '$findings.procedures', preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: null,
                        totalProceduresCost: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$findings.procedures.is_active', true] },
                                    { $ifNull: ['$findings.procedures.procedure_cost', 0] },
                                    0,
                                ],
                            },
                        },
                    },
                },
            ]),

            // Por sucursal
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                {
                    $group: {
                        _id: { id: '$branch.id', name: '$branch.name' },
                        total: { $sum: 1 },
                        delivered: {
                            $sum: { $cond: [{ $eq: ['$currentStatus.id', 8] }, 1, 0] }
                        },
                        // suma de pagos INGRESO embebidos
                        revenue: {
                            $sum: {
                                $reduce: {
                                    input: '$payments',
                                    initialValue: 0,
                                    in: {
                                        $add: [
                                            '$$value',
                                            { $cond: [{ $eq: ['$$this.flow_type', 'INGRESO'] }, '$$this.amount', 0] }
                                        ]
                                    }
                                }
                            }
                        },
                    },
                },
                { $project: { _id: 0, branchId: '$_id.id', branchName: '$_id.name', total: 1, delivered: 1, revenue: 1 } },
                { $sort: { total: -1 } },
            ]),

            // Por técnico top 10
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, 'technicians.0': { $exists: true } } },
                { $unwind: '$technicians' },
                {
                    $group: {
                        _id: '$technicians.id',
                        name: { $first: { $concat: ['$technicians.first_name', ' ', '$technicians.last_name'] } },
                        total: { $sum: 1 },
                        resolved: {
                            $sum: { $cond: [{ $in: ['$currentStatus.id', [7, 8]] }, 1, 0] }
                        },
                    },
                },
                { $project: { _id: 0, techId: '$_id', name: 1, total: 1, resolved: 1 } },
                { $sort: { total: -1 } },
                { $limit: 10 },
            ]),

            // Tendencia últimas 4 semanas
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, entry_date: { $gte: since } } },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$entry_date', timezone: 'America/Guayaquil' }
                        },
                        ingresadas: { $sum: 1 },
                        entregadas: {
                            $sum: { $cond: [{ $eq: ['$currentStatus.id', 8] }, 1, 0] }
                        },
                        revenue: {
                            $sum: {
                                $reduce: {
                                    input: '$payments',
                                    initialValue: 0,
                                    in: {
                                        $add: [
                                            '$$value',
                                            { $cond: [{ $eq: ['$$this.flow_type', 'INGRESO'] }, '$$this.amount', 0] }
                                        ]
                                    }
                                }
                            }
                        },
                    },
                },
                { $project: { _id: 0, date: '$_id', ingresadas: 1, entregadas: 1, revenue: 1 } },
                { $sort: { date: 1 } },
            ]),
        ]);

        const totalAll = byStatus.reduce((s: number, r: any) => s + r.count, 0);
        const totalDelivered = byStatus.find((r: any) => r.id === 8)?.count ?? 0;
        const totalFinished = byStatus.find((r: any) => r.id === 7)?.count ?? 0;
        const totalPaid = byBranch.reduce((s: number, b: any) => s + b.revenue, 0);
        const totalCost = financeData[0]?.totalProceduresCost ?? 0;

        return {
            totals: {
                all: totalAll,
                active: totalAll - totalDelivered,
                delivered: totalDelivered,
                finished: totalFinished,
            },
            byStatus,
            finance: {
                totalProceduresCost: totalCost,
                totalPaid,
                totalPending: totalCost - totalPaid,
            },
            byBranch,
            byTechnician,
            weeklyTrend,
        };
    }
}