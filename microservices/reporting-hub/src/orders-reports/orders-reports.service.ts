import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';

import { OrderStatus, OrderStatusDocument } from '../orders-relay/schemas/order-status.schema';
import { OrderType, OrderTypeDocument } from '../orders-relay/schemas/order-type.schema';
import { CompanyReplica, CompanyReplicaDocument } from '../companies/schemas/company-replica.schema';
import { UserEmployeeCache, UserEmployeeCacheDocument } from '../users-employees-events/schemas/user-employee-cache.schema';
import { GetOrdersFilterDto } from './dto/order-filters-metadata.dto';
import { OrderReplica, OrderReplicaDocument } from '../orders-relay/schemas/order-replica.schema';

import { RpcException } from '@nestjs/microservices';
import { OrdersFilterInternalDto } from '../orders-relay/schemas/order-filters-internal.dto';
// Enum de claves válidas — agrega aquí cuando haya nuevas tarjetas
import { DRILL_CARD_KEYS, DrillCardKey } from './constants/drill-cards.constants';
import { OrderValidation, OrderValidationDocument } from '../order-validation/schemas/order-validation.schema';
import { EmployeeCommission, EmployeeCommissionDocument } from '../users-employees-events/schemas/employee-commission.schema';
import { calculateCommissions, hasActiveCommissions } from './helpers/commission.helper';
type SortMode = 'entry_date' | 'finalized_at' | 'delivered_at' | 'last_paid_at';
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
        @InjectModel(OrderValidation.name) private orderValidationModel: Model<OrderValidationDocument>,
        @InjectModel(EmployeeCommission.name)
        private readonly employeeCommissionModel: Model<EmployeeCommissionDocument>
    ) { }



    async getDashboardDrill(
        companyId: string,
        card: string,
        page: number,
        limit: number,
    ): Promise<{ data: any[]; total: number }> {

        const GYE_OFFSET_MS = -5 * 60 * 60 * 1000;
        const { todayStart, todayEnd } = this._dayBoundaries();

        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 6);

        const localNow = new Date(Date.now() + GYE_OFFSET_MS);
        const monthStartLocal = new Date(localNow.getFullYear(), localNow.getMonth(), 1, 3, 0, 0, 0);
        const monthStart = new Date(monthStartLocal.getTime() - GYE_OFFSET_MS);
        const now = new Date();

        const rangeMatch = card.match(/^(range_\w+)\((\d{4}-\d{2}-\d{2})\|(\d{4}-\d{2}-\d{2})\)$/);

        let resolvedCard: string = card;
        let rangeFrom: Date | null = null;
        let rangeTo: Date | null = null;

        if (rangeMatch) {
            resolvedCard = rangeMatch[1];
            const [fromY, fromM, fromD] = rangeMatch[2].split('-').map(Number);
            const [toY, toM, toD] = rangeMatch[3].split('-').map(Number);
            rangeFrom = new Date(Date.UTC(fromY, fromM - 1, fromD, 3, 0, 0, 0));
            rangeTo = new Date(Date.UTC(toY, toM - 1, toD + 1, 2, 59, 59, 999));
        }

        const ALL_VALID_KEYS = [
            ...DRILL_CARD_KEYS,
            'range_received', 'range_finished', 'range_delivered', 'range_collected',
            'global_validation_checked', 'global_validation_unchecked',
        ];

        if (!ALL_VALID_KEYS.includes(resolvedCard as any)) {
            throw new RpcException({ status: 400, message: `Unknown card key: "${card}"` });
        }

        const strategies: Record<string, Record<string, any>> = {
            today_received: { entry_date: { $gte: todayStart, $lte: todayEnd } },
            today_finished: {
                statusHistory: { $elemMatch: { 'toStatus.id': 7, changed_at: { $gte: todayStart, $lte: todayEnd } } },
                'currentStatus.id': { $in: [7, 8] },
            },
            today_delivered: {
                statusHistory: { $elemMatch: { 'toStatus.id': 8, changed_at: { $gte: todayStart, $lte: todayEnd } } },
            },
            today_collected: {
                payments: { $elemMatch: { flow_type: 'INGRESO', paid_at: { $gte: todayStart, $lte: todayEnd } } },
            },

            week_received: { entry_date: { $gte: weekStart, $lte: todayEnd } },
            week_finished: {
                statusHistory: { $elemMatch: { 'toStatus.id': 7, changed_at: { $gte: weekStart, $lte: todayEnd } } },
                'currentStatus.id': { $in: [7, 8] },
            },
            week_delivered: {
                statusHistory: { $elemMatch: { 'toStatus.id': 8, changed_at: { $gte: weekStart, $lte: todayEnd } } },
            },
            week_collected: {
                payments: { $elemMatch: { flow_type: 'INGRESO', paid_at: { $gte: weekStart, $lte: todayEnd } } },
            },

            month_received: { entry_date: { $gte: monthStart, $lte: now } },
            month_finished: {
                statusHistory: { $elemMatch: { 'toStatus.id': 7, changed_at: { $gte: monthStart, $lte: now } } },
                'currentStatus.id': { $in: [7, 8] },
            },
            month_delivered: {
                statusHistory: { $elemMatch: { 'toStatus.id': 8, changed_at: { $gte: monthStart, $lte: now } } },
            },
            month_collected: {
                payments: { $elemMatch: { flow_type: 'INGRESO', paid_at: { $gte: monthStart, $lte: now } } },
            },

            global_all: {},
            global_pending: { 'currentStatus.id': { $in: [1] } },
            global_in_progress: { 'currentStatus.id': { $in: [6] } },
            global_waiting_parts: { 'currentStatus.id': { $in: [5] } },
            global_waiting_approval: { 'currentStatus.id': { $in: [4] } },
            global_finished: { 'currentStatus.id': { $in: [7, 8] } },
            global_delivered: { 'currentStatus.id': { $in: [8] } },
            global_validation_checked: { 'currentStatus.id': { $in: [8] } },
            global_validation_unchecked: { 'currentStatus.id': { $in: [8] } },

            ...(rangeFrom && rangeTo ? {
                range_received: { entry_date: { $gte: rangeFrom, $lte: rangeTo } },
                range_finished: {
                    statusHistory: { $elemMatch: { 'toStatus.id': 7, changed_at: { $gte: rangeFrom, $lte: rangeTo } } },
                    'currentStatus.id': { $in: [7, 8] },
                },
                range_delivered: {
                    statusHistory: { $elemMatch: { 'toStatus.id': 8, changed_at: { $gte: rangeFrom, $lte: rangeTo } } },
                },
                range_collected: {
                    payments: { $elemMatch: { flow_type: 'INGRESO', paid_at: { $gte: rangeFrom, $lte: rangeTo } } },
                },
            } : {}),
        };

        // ── SortMode por card ─────────────────────────────────────────────────────
        const SORT_MODE_MAP: Record<string, SortMode> = {
            today_received: 'entry_date',
            week_received: 'entry_date',
            month_received: 'entry_date',
            range_received: 'entry_date',

            today_finished: 'finalized_at',
            week_finished: 'finalized_at',
            month_finished: 'finalized_at',
            range_finished: 'finalized_at',

            today_delivered: 'delivered_at',
            week_delivered: 'delivered_at',
            month_delivered: 'delivered_at',
            range_delivered: 'delivered_at',
            global_delivered: 'delivered_at',

            today_collected: 'last_paid_at',
            week_collected: 'last_paid_at',
            month_collected: 'last_paid_at',
            range_collected: 'last_paid_at',
        };

        const sortMode: SortMode = SORT_MODE_MAP[resolvedCard] ?? 'entry_date';

        const VALIDATION_CARDS = ['global_validation_checked', 'global_validation_unchecked'];
        const isValidationCard = VALIDATION_CARDS.includes(resolvedCard);

        const postLookupMatch = resolvedCard === 'global_validation_checked'
            ? { '_validation.is_checked': true }
            : resolvedCard === 'global_validation_unchecked'
                ? { '_validation.is_checked': false }
                : null;

        const matchStage: Record<string, any> = {
            'company.id': companyId,
            ...strategies[resolvedCard],
        };

        return this._executeDrillPipeline(
            matchStage,
            page,
            limit,
            sortMode === 'delivered_at' || isValidationCard, // includeValidation
            sortMode,
            postLookupMatch,
        );
    }

    private async _executeDrillPipeline(
        matchStage: Record<string, any>,
        page: number,
        limit: number,
        includeValidation = false,
        sortMode: SortMode = 'entry_date',
        postLookupMatch: Record<string, any> | null = null,
    ): Promise<{ data: any[]; total: number }> {

        const skip = (page - 1) * limit;
        const now = new Date();

        const lookupStage: PipelineStage[] = includeValidation
            ? [{ $lookup: { from: 'order_validations', localField: 'id', foreignField: 'order_id', as: '_validation' } }]
            : [];

        const postLookupMatchStage: PipelineStage[] = postLookupMatch
            ? [{ $match: postLookupMatch }]
            : [];

        // ── $addFields: calcula _sort_date según el modo ──────────────────────────
        const addFieldsStage: PipelineStage[] = (() => {
            switch (sortMode) {
                case 'delivered_at':
                    return [{
                        $addFields: {
                            _sort_date: {
                                $max: {
                                    $map: {
                                        input: {
                                            $filter: {
                                                input: { $ifNull: ['$statusHistory', []] },
                                                as: 'h',
                                                cond: { $eq: ['$$h.toStatus.id', 8] },
                                            },
                                        },
                                        as: 'h',
                                        in: '$$h.changed_at',
                                    },
                                },
                            },
                        },
                    }];

                case 'finalized_at':
                    return [{
                        $addFields: {
                            _sort_date: {
                                $max: {
                                    $map: {
                                        input: {
                                            $filter: {
                                                input: { $ifNull: ['$statusHistory', []] },
                                                as: 'h',
                                                cond: { $eq: ['$$h.toStatus.id', 7] },
                                            },
                                        },
                                        as: 'h',
                                        in: '$$h.changed_at',
                                    },
                                },
                            },
                        },
                    }];

                case 'last_paid_at':
                    return [{
                        $addFields: {
                            _sort_date: {
                                $max: {
                                    $map: {
                                        input: {
                                            $filter: {
                                                input: { $ifNull: ['$payments', []] },
                                                as: 'p',
                                                cond: { $eq: ['$$p.flow_type', 'INGRESO'] },
                                            },
                                        },
                                        as: 'p',
                                        in: '$$p.paid_at',
                                    },
                                },
                            },
                        },
                    }];

                default: // 'entry_date' — no necesita $addFields
                    return [];
            }
        })();

        const sortStage: PipelineStage = sortMode === 'entry_date'
            ? { $sort: { entry_date: -1 } }
            : { $sort: { _sort_date: -1 } };

        const validationProjection = includeValidation
            ? { _validation: { $arrayElemAt: ['$_validation', 0] } }
            : {};

        const sortDateProjection = sortMode !== 'entry_date'
            ? { _sort_date: 1 }
            : {};

        const [result] = await this.orderReplicaModel.aggregate([
            { $match: matchStage },
            ...lookupStage,
            ...postLookupMatchStage,
            ...addFieldsStage,
            sortStage,
            {
                $facet: {
                    total: [{ $count: 'count' }],
                    data: [
                        { $skip: skip },
                        { $limit: limit },
                        {
                            $project: {
                                id: 1, order_number: 1, revisadoAntes: 1,
                                currentStatus: 1, type: 1,
                                branch: { id: '$branch.id', name: '$branch.name' },
                                customer: { id: '$customer.id', firstName: '$customer.firstName', lastName: '$customer.lastName' },
                                device: { model: '$device.model.models_name', brand: '$device.model.brand_name', type: '$device.type.name' },
                                technicians: 1, entry_date: 1,
                                estimated_price: 1, statusHistory: 1,
                                findings: 1, payments: 1,
                                ...validationProjection,
                                ...sortDateProjection,
                            },
                        },
                    ],
                },
            },
        ]);

        const total = result?.total?.[0]?.count ?? 0;
        const raw = result?.data ?? [];

        const data = raw.map((order): any => {

            const finalizedAt = sortMode === 'finalized_at'
                ? (order._sort_date ?? null)
                : order.statusHistory
                    ?.filter(h => h.toStatus?.id === 7)
                    .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
                [0]?.changed_at ?? null;

            const completedAt = sortMode === 'delivered_at'
                ? (order._sort_date ?? null)
                : order.statusHistory
                    ?.filter(h => h.toStatus?.id === 8)
                    .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
                [0]?.changed_at ?? null;

            const totalProceduresCost = order.findings?.reduce((sumF, finding) =>
                sumF + (finding.procedures?.reduce((sumP, proc) =>
                    sumP + (proc.is_active ? (proc.procedure_cost ?? 0) : 0), 0) ?? 0), 0) ?? 0;

            const totalPaid = order.payments?.reduce((sum, p) =>
                sum + (p.flow_type === 'INGRESO' ? (p.amount ?? 0) : 0), 0) ?? 0;

            const activeFindings = order.findings?.filter(f => f.is_active) ?? [];
            const findingsSummary = {
                total: activeFindings.length,
                resolved: activeFindings.filter(f => f.is_resolved).length,
                pending: activeFindings.filter(f => !f.is_resolved).length,
            };

            const hasActiveWarranty = order.findings?.some(finding =>
                finding.procedures?.some(proc => {
                    if (!proc.is_active || !proc.warranty_days || proc.warranty_days <= 0) return false;
                    if (!completedAt) return true;
                    const expiresAt = new Date(completedAt);
                    expiresAt.setDate(expiresAt.getDate() + proc.warranty_days);
                    return expiresAt > now;
                }),
            ) ?? false;

            const validation = order._validation
                ? {
                    _id: order._validation._id,
                    is_checked: order._validation.is_checked ?? false,
                    daily_sequential: order._validation.daily_sequential ?? null,
                }
                : null;

            return {
                id: order.id,
                order_number: order.order_number,
                revisadoAntes: order.revisadoAntes,
                currentStatus: order.currentStatus,
                type: order.type,
                branch: order.branch,
                customer: order.customer,
                device: order.device,
                technicians: order.technicians?.map(t => ({ id: t.id, first_name: t.first_name, last_name: t.last_name })) ?? [],
                entry_date: order.entry_date,
                finalized_at: finalizedAt,
                completed_at: completedAt,
                estimated_price: order.estimated_price ?? null,
                total_procedures_cost: totalProceduresCost,
                total_paid: totalPaid,
                findings_summary: findingsSummary,
                has_active_warranty: hasActiveWarranty,
                validation,
            };
        });

        return { data, total };
    }

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
        data: any[];
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
                    statusHistory: 1,
                    findings: 1,
                    payments: 1,
                })
                .sort({ entry_date: -1 })
                .lean(),

            this.orderReplicaModel.countDocuments(filter),
        ]);

        const now = new Date();
        const data = raw.map((order): any => {

            // ── 1. Fecha trabajo finalizado (id = 7) ──────────────────
            const finalizedAt = order.statusHistory
                ?.filter(h => h.toStatus?.id === 7)
                .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
            [0]?.changed_at ?? null;

            // ── 2. Fecha entregada (id = 8) ───────────────────────────
            const completedAt = order.statusHistory
                ?.filter(h => h.toStatus?.id === 8)
                .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
            [0]?.changed_at ?? null;

            // ── 3. Costos de procedimientos ───────────────────────────
            const totalProceduresCost = order.findings?.reduce((sumF, finding) =>
                sumF + (finding.procedures?.reduce((sumP, proc) =>
                    sumP + (proc.is_active ? (proc.procedure_cost ?? 0) : 0),
                    0) ?? 0),
                0) ?? 0;

            // ── 4. Total pagado (solo INGRESO) ────────────────────────
            const totalPaid = order.payments?.reduce((sum, p) =>
                sum + (p.flow_type === 'INGRESO' ? (p.amount ?? 0) : 0),
                0) ?? 0;

            // ── 5. Resumen de hallazgos ───────────────────────────────
            const activeFindings = order.findings?.filter(f => f.is_active) ?? [];
            const findingsSummary = {
                total: activeFindings.length,
                resolved: activeFindings.filter(f => f.is_resolved).length,
                pending: activeFindings.filter(f => !f.is_resolved).length,
            };

            // ── 6. Garantía activa ────────────────────────────────────
            const hasActiveWarranty = order.findings?.some(finding =>
                finding.procedures?.some(proc => {
                    if (!proc.is_active || !proc.warranty_days || proc.warranty_days <= 0) return false;
                    if (!completedAt) return true;
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
                finalized_at: finalizedAt,   // ← nuevo
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

        // ── Arrays de IDs → $in ──────────────────────────────────────────────────
        if (dto.status?.length)
            filter['currentStatus.id'] = { $in: dto.status.map(Number) };

        if (dto.orderType?.length)
            filter['type.id'] = { $in: dto.orderType.map(Number) };

        if (dto.branch?.length)
            filter['branch.id'] = { $in: dto.branch };

        if (dto.technician?.length)
            filter['technicians.id'] = { $in: dto.technician };

        if (dto.receptionist?.length)
            filter['createdBy.id'] = { $in: dto.receptionist };

        // ── Período de ingreso (entry_date) ──────────────────────────────────────
        const ingresoRange = this.resolveDateRange(
            dto.periodMode, dto.presetPeriod, dto.dateFrom, dto.dateTo
        );
        if (ingresoRange) filter['entry_date'] = ingresoRange;

        // ── Período de finalización (statusHistory → toStatus.id = 7) ────────────
        const endRange = this.resolveDateRange(
            dto.endPeriodMode, dto.endPresetPeriod, dto.endDateFrom, dto.endDateTo
        );
        if (endRange) {
            filter['statusHistory'] = {
                $elemMatch: { 'toStatus.id': 7, changed_at: endRange },
            };
        }

        // ── Período de entrega (statusHistory → toStatus.id = 8) ─────────────────
        const deliveryRange = this.resolveDateRange(
            dto.deliveryPeriodMode, dto.deliveryPresetPeriod, dto.deliveryDateFrom, dto.deliveryDateTo
        );
        if (deliveryRange) {
            if (filter['statusHistory']) {
                // Ambos filtros activos → $all con dos $elemMatch sobre el mismo campo
                filter['statusHistory'] = {
                    $all: [
                        { $elemMatch: filter['statusHistory'].$elemMatch },
                        { $elemMatch: { 'toStatus.id': 8, changed_at: deliveryRange } },
                    ],
                };
            } else {
                filter['statusHistory'] = {
                    $elemMatch: { 'toStatus.id': 8, changed_at: deliveryRange },
                };
            }
        }

        return filter;
    }

    // ── Helper compartido: mode + preset/custom → objeto $gte/$lt ────────────────
    private resolveDateRange(
        mode?: 'preset' | 'custom',
        preset?: string,
        from?: string,
        to?: string,
    ): Record<string, Date> | null {

        if (mode === 'preset' && preset) {
            const [year, month] = preset.split('-').map(Number);
            return {
                $gte: new Date(year, month - 1, 1),
                $lt: new Date(year, month, 1),     // primer día del mes siguiente
            };
        }

        if (mode === 'custom' && (from || to)) {
            const range: Record<string, Date> = {};
            if (from) range.$gte = new Date(from);
            if (to) {
                const end = new Date(to);
                end.setHours(23, 59, 59, 999);
                range.$lte = end;
            }
            return range;
        }

        return null;
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
        console.log(userId)
        const isAdmin = groups.some(g => ['COMPANY_ADMIN', 'ADMINS', 'IFE'].includes(g));
        const isTechnician = groups.some(g => ['TECHNICIANS', 'CSRSPER'].includes(g));
        const isCashier = groups.includes('CASHIERS');

        const [technician, cashier, admin] = await Promise.all([
            isTechnician ? this.getTechnicianDashboard(companyId, userId) : Promise.resolve(undefined),
            isCashier ? this.getCashierDashboard(companyId, userId) : Promise.resolve(undefined),
            isAdmin ? this.getAdminDashboard(companyId) : Promise.resolve(undefined),
        ]);

        return { groups, technician, cashier, admin };
    }

    // ── TECHNICIAN ────────────────────────────────────────────────────────────────
    private async getTechnicianDashboard(companyId: string, userId: string): Promise<any> {
        const RESOLVED_IDS = [7, 8]; // TRABAJO_FINALIZADO, ENTREGADA
        const FINALIZED_STATUS_ID = 7;    // TRABAJO_FINALIZADO — punto de corte para comisiones

        const [byStatus, byBranch, ordersForCommission, employeeCommission] = await Promise.all([

            // ── Conteo por estado ─────────────────────────────────────────────────
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, 'technicians.id': userId } },
                { $group: { _id: '$currentStatus.name', count: { $sum: 1 } } },
                { $project: { _id: 0, name: '$_id', count: 1 } },
                { $sort: { count: -1 } },
            ]),

            // ── Conteo por sucursal con resolved ─────────────────────────────────
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, 'technicians.id': userId } },
                {
                    $group: {
                        _id: '$branch.name',
                        total: { $sum: 1 },
                        resolved: {
                            $sum: {
                                $cond: [{ $in: ['$currentStatus.id', RESOLVED_IDS] }, 1, 0],
                            },
                        },
                    },
                },
                { $project: { _id: 0, name: '$_id', total: 1, resolved: 1 } },
                { $sort: { total: -1 } },
            ]),

            // ── Órdenes candidatas a comisión ─────────────────────────────────────
            // Condiciones en la query:
            //   1. El técnico está asignado
            //   2. La orden tiene al menos un evento TRABAJO_FINALIZADO en el historial
            //   3. El técnico hizo al menos un procedimiento con costo
            // Proyección mínima: solo los campos que usa calculateCommissions
            this.orderReplicaModel.find(
                {
                    'company.id': companyId,
                    'technicians.id': userId,
                    'statusHistory.toStatus.id': FINALIZED_STATUS_ID,
                    'findings.procedures.performedBy.id': userId,
                    'findings.procedures.procedure_cost': { $gt: 0 },
                },
                {
                    id: 1,
                    order_number: 1,
                    'device.type': 1,
                    // Solo procedimientos del técnico con costo (filtro fino en el helper)
                    'findings.procedures.id': 1,
                    'findings.procedures.description': 1,
                    'findings.procedures.procedure_cost': 1,
                    'findings.procedures.performedBy': 1,
                    // Historial: solo los eventos TRABAJO_FINALIZADO
                    // (traemos todo y filtramos en el helper para mantener la lógica allí)
                    'statusHistory.toStatus': 1,
                    'statusHistory.changed_at': 1,
                },
            ).lean(),

            // ── Configuración de comisiones del técnico ───────────────────────────
            this.employeeCommissionModel
                .findOne({ employeeId: userId })
                .lean(),
        ]);

        // ── Calcular comisiones ───────────────────────────────────────────────────
        const commissions = employeeCommission?.commissions ?? [];
        const technicianHasCommissions = hasActiveCommissions(commissions);

        const commissionData = technicianHasCommissions
            ? calculateCommissions(userId, commissions, ordersForCommission as any)
            : null;

        // ── Totales de órdenes ────────────────────────────────────────────────────
        const totalAssigned = byStatus.reduce((s, r) => s + r.count, 0);
        const totalResolved = byBranch.reduce((s, r) => s + r.resolved, 0);

        return {
            // — Órdenes —
            totalAssigned,
            totalResolved,
            totalPending: totalAssigned - totalResolved,
            byStatus,
            byBranch,

            // — Comisiones —
            hasCommissions: technicianHasCommissions,
            commissions: commissionData
                ? {
                    today: {
                        total: commissionData.today.totalAmount,
                        entries: commissionData.today.entries,
                    },
                    week: {
                        total: commissionData.week.totalAmount,
                        entries: commissionData.week.entries,
                    },
                    month: {
                        total: commissionData.month.totalAmount,
                        entries: commissionData.month.entries,
                    },
                    allTime: {
                        total: commissionData.allTime.totalAmount,
                        entries: commissionData.allTime.entries,
                    },
                }
                : null,
        };
    }

    // ── CASHIERS ──────────────────────────────────────────────────────────────────
    // En getDashboard, pasar userId al cashier
    private async getCashierDashboard(companyId: string, userId: string): Promise<any> {
        const { todayStart, todayEnd } = this._dayBoundaries();
        const { lastMondayUTC, lastSundayUTC, lastMondayLocal } = this._lastWeekBoundaries();

        const [todayData, lastWeekData] = await Promise.all([

            // Hoy
            this.orderReplicaModel.aggregate([
                {
                    $match: {
                        'company.id': companyId,
                        'createdBy.id': userId,
                        entry_date: { $gte: todayStart, $lt: todayEnd },
                    },
                },
                {
                    $group: {
                        _id: null,
                        ingresadas: { $sum: 1 },
                        entregadas: {
                            $sum: { $cond: [{ $eq: ['$currentStatus.id', 8] }, 1, 0] },
                        },
                    },
                },
            ]),

            // Semana anterior día a día
            this.orderReplicaModel.aggregate([
                {
                    $match: {
                        'company.id': companyId,
                        'createdBy.id': userId,
                        entry_date: { $gte: lastMondayUTC, $lt: lastSundayUTC },
                    },
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$entry_date',
                                timezone: 'America/Guayaquil',
                            },
                        },
                        ingresadas: { $sum: 1 },
                        entregadas: {
                            $sum: { $cond: [{ $eq: ['$currentStatus.id', 8] }, 1, 0] },
                        },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
        ]);

        const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const byDay = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(lastMondayLocal);
            d.setDate(lastMondayLocal.getDate() + i);
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
    // ── Utilidad: límite de "día" con corte a las 03:00 Guayaquil ────────────────
    private _dayBoundaries(): { todayStart: Date; todayEnd: Date } {
        const GYE_OFFSET_MS = -5 * 60 * 60 * 1000; // UTC-5 → -18 000 000 ms

        const nowUTC = new Date();
        // ✅ local = UTC + offset  (offset es negativo → resta 5 h)
        const nowLocal = new Date(nowUTC.getTime() + GYE_OFFSET_MS);

        const cutHour = 3;
        const base = new Date(nowLocal);
        if (nowLocal.getHours() < cutHour) {
            base.setDate(base.getDate() - 1);
        }
        base.setHours(cutHour, 0, 0, 0); // base está en hora local GYE

        // ✅ UTC = local - offset  (offset negativo → suma 5 h)
        const todayStart = new Date(base.getTime() - GYE_OFFSET_MS);
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
        return { todayStart, todayEnd };
    }
    private _lastWeekBoundaries(): { lastMondayUTC: Date; lastSundayUTC: Date; lastMondayLocal: Date } {
        const GYE_OFFSET_MS = -5 * 60 * 60 * 1000;
        const CUT_HOUR = 3;

        const nowLocal = new Date(new Date().getTime() + GYE_OFFSET_MS);

        const baseLocal = new Date(nowLocal);
        if (nowLocal.getHours() < CUT_HOUR) baseLocal.setDate(baseLocal.getDate() - 1);
        baseLocal.setHours(CUT_HOUR, 0, 0, 0);

        const dow = baseLocal.getDay() === 0 ? 7 : baseLocal.getDay(); // 1=Lun … 7=Dom
        const lastMondayLocal = new Date(baseLocal);
        lastMondayLocal.setDate(baseLocal.getDate() - dow - 6);

        const lastSundayLocal = new Date(lastMondayLocal);
        lastSundayLocal.setDate(lastMondayLocal.getDate() + 7);

        return {
            lastMondayUTC: new Date(lastMondayLocal.getTime() - GYE_OFFSET_MS),
            lastSundayUTC: new Date(lastSundayLocal.getTime() - GYE_OFFSET_MS),
            lastMondayLocal, // necesario para generar las keys del byDay
        };
    }
    // ── Estadísticas de un período: órdenes ingresadas + cobros registrados ───────
    private async _periodStats(companyId: string, from: Date, to: Date) {
        const [orders, payments] = await Promise.all([
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, entry_date: { $gte: from, $lt: to } } },
                {
                    $group: {
                        _id: null,
                        received: { $sum: 1 },
                        finished: { $sum: { $cond: [{ $in: ['$currentStatus.id', [7, 8]] }, 1, 0] } },
                        delivered: { $sum: { $cond: [{ $eq: ['$currentStatus.id', 8] }, 1, 0] } },
                    },
                },
            ]),
            // Cobros cuya fecha de pago cae dentro del período
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                { $unwind: '$payments' },
                {
                    $match: {
                        'payments.flow_type': 'INGRESO',
                        'payments.paid_at': { $gte: from, $lt: to },
                    },
                },
                {
                    $group: {
                        _id: null,
                        collected: { $sum: '$payments.amount' },
                        paymentsCount: { $sum: 1 },
                    },
                },
            ]),
        ]);

        return {
            received: orders[0]?.received ?? 0,
            finished: orders[0]?.finished ?? 0,
            delivered: orders[0]?.delivered ?? 0,
            collected: payments[0]?.collected ?? 0,
            paymentsCount: payments[0]?.paymentsCount ?? 0,
        };
    }
    /**
     * 'YYYY-MM-DD' → inicio del día en hora GYE
     * 03:00 GYE == 08:00 UTC
     */
    private _gyeDayStart(dateStr: string): Date {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d, 8, 0, 0, 0));
    }

    /**
     * 'YYYY-MM-DD' → inicio del día SIGUIENTE en hora GYE
     * Así el día `to` queda completamente incluido en el rango
     */
    private _gyeDayEnd(dateStr: string): Date {
        const start = this._gyeDayStart(dateStr);
        return new Date(start.getTime() + 24 * 60 * 60 * 1000);
    }

    // ── Dashboard principal ───────────────────────────────────────────────────────
    private async getAdminDashboard(companyId: string): Promise<any> {

        const { todayStart, todayEnd } = this._dayBoundaries();

        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 6);

        const GYE_OFFSET_MS = -5 * 60 * 60 * 1000;
        const localNow = new Date(Date.now() + GYE_OFFSET_MS);
        const monthStartLocal = new Date(localNow.getFullYear(), localNow.getMonth(), 1, 3, 0, 0, 0);
        const monthStart = new Date(monthStartLocal.getTime() - GYE_OFFSET_MS);
        const since4w = new Date(todayStart);
        since4w.setDate(since4w.getDate() - 27);
        const now = new Date();

        const [
            byStatus,
            financeData,
            byBranch,
            byTechnician,
            weeklyTrend,
            [statsDay, statsWeek, statsMonth],
            hourlyToday,
            byDeviceBrand,
            byOrderType,
            paymentMethods,
            resolutionTime,
            drillCounts,
            validationCounts,
        ] = await Promise.all([

            // ── Por estado (global) ───────────────────────────────────────────────
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

            // ── Finanzas globales ─────────────────────────────────────────────────
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

            // ── Por sucursal ──────────────────────────────────────────────────────
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                {
                    $group: {
                        _id: { id: '$branch.id', name: '$branch.name' },
                        total: { $sum: 1 },
                        delivered: { $sum: { $cond: [{ $eq: ['$currentStatus.id', 8] }, 1, 0] } },
                        revenue: {
                            $sum: {
                                $reduce: {
                                    input: '$payments', initialValue: 0,
                                    in: { $add: ['$$value', { $cond: [{ $eq: ['$$this.flow_type', 'INGRESO'] }, '$$this.amount', 0] }] },
                                },
                            },
                        },
                    },
                },
                { $project: { _id: 0, branchId: '$_id.id', branchName: '$_id.name', total: 1, delivered: 1, revenue: 1 } },
                { $sort: { total: -1 } },
            ]),

            // ── Top 10 técnicos ───────────────────────────────────────────────────
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, 'technicians.0': { $exists: true } } },
                { $unwind: '$technicians' },
                {
                    $group: {
                        _id: '$technicians.id',
                        name: { $first: { $concat: ['$technicians.first_name', ' ', '$technicians.last_name'] } },
                        total: { $sum: 1 },
                        resolved: { $sum: { $cond: [{ $in: ['$currentStatus.id', [7, 8]] }, 1, 0] } },
                    },
                },
                { $project: { _id: 0, techId: '$_id', name: 1, total: 1, resolved: 1 } },
                { $sort: { total: -1 } },
                { $limit: 10 },
            ]),

            // ── Tendencia 4 semanas ───────────────────────────────────────────────
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, entry_date: { $gte: since4w } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$entry_date', timezone: 'America/Guayaquil' } },
                        ingresadas: { $sum: 1 },
                        entregadas: { $sum: { $cond: [{ $eq: ['$currentStatus.id', 8] }, 1, 0] } },
                        revenue: {
                            $sum: {
                                $reduce: {
                                    input: '$payments', initialValue: 0,
                                    in: { $add: ['$$value', { $cond: [{ $eq: ['$$this.flow_type', 'INGRESO'] }, '$$this.amount', 0] }] },
                                },
                            },
                        },
                    },
                },
                { $project: { _id: 0, date: '$_id', ingresadas: 1, entregadas: 1, revenue: 1 } },
                { $sort: { date: 1 } },
            ]),

            // ── Estadísticas por período: hoy / semana / mes ──────────────────────
            Promise.all([
                this._periodStats(companyId, todayStart, todayEnd),
                this._periodStats(companyId, weekStart, todayEnd),
                this._periodStats(companyId, monthStart, now),
            ]),

            // ── Distribución horaria de HOY ───────────────────────────────────────
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, entry_date: { $gte: todayStart, $lt: todayEnd } } },
                {
                    $group: {
                        _id: { $hour: { date: '$entry_date', timezone: 'America/Guayaquil' } },
                        count: { $sum: 1 },
                        revenue: {
                            $sum: {
                                $reduce: {
                                    input: '$payments', initialValue: 0,
                                    in: { $add: ['$$value', { $cond: [{ $eq: ['$$this.flow_type', 'INGRESO'] }, '$$this.amount', 0] }] },
                                },
                            },
                        },
                    },
                },
                { $project: { _id: 0, hour: '$_id', count: 1, revenue: 1 } },
                { $sort: { hour: 1 } },
            ]),

            // ── Top 8 marcas de dispositivo ───────────────────────────────────────
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, 'device.model.brand_name': { $exists: true, $ne: null } } },
                {
                    $group: {
                        _id: { id: '$device.model.brand_id', name: '$device.model.brand_name' },
                        total: { $sum: 1 },
                    },
                },
                { $project: { _id: 0, brandId: '$_id.id', brandName: '$_id.name', total: 1 } },
                { $sort: { total: -1 } },
                { $limit: 8 },
            ]),

            // ── Por tipo de orden ─────────────────────────────────────────────────
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                {
                    $group: {
                        _id: { id: '$type.id', name: '$type.name' },
                        count: { $sum: 1 },
                    },
                },
                { $project: { _id: 0, typeId: '$_id.id', typeName: '$_id.name', count: 1 } },
                { $sort: { count: -1 } },
            ]),

            // ── Métodos de pago (INGRESO) ─────────────────────────────────────────
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                { $unwind: '$payments' },
                { $match: { 'payments.flow_type': 'INGRESO' } },
                {
                    $group: {
                        _id: { id: '$payments.payment_method_id', name: '$payments.payment_method_name' },
                        total: { $sum: '$payments.amount' },
                        count: { $sum: 1 },
                    },
                },
                { $project: { _id: 0, methodId: '$_id.id', methodName: '$_id.name', total: 1, count: 1 } },
                { $sort: { total: -1 } },
            ]),

            // ── Tiempo promedio de resolución ─────────────────────────────────────
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, 'currentStatus.id': { $in: [7, 8] } } },
                { $unwind: '$statusHistory' },
                { $match: { 'statusHistory.toStatus.id': { $in: [7, 8] } } },
                {
                    $group: {
                        _id: '$_id',
                        entry_date: { $first: '$entry_date' },
                        resolved_at: { $max: '$statusHistory.changed_at' },
                    },
                },
                {
                    $project: {
                        diffDays: { $divide: [{ $subtract: ['$resolved_at', '$entry_date'] }, 86_400_000] },
                    },
                },
                {
                    $group: {
                        _id: null,
                        avgDays: { $avg: '$diffDays' },
                        minDays: { $min: '$diffDays' },
                        maxDays: { $max: '$diffDays' },
                    },
                },
                { $project: { _id: 0, avgDays: { $round: ['$avgDays', 1] }, minDays: { $round: ['$minDays', 1] }, maxDays: { $round: ['$maxDays', 1] } } },
            ]),

            // ── Conteos de tarjetas drill (1 sola query con $facet) ───────────────
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                {
                    $facet: {

                        // ── Hoy ──────────────────────────────────────────────────
                        today_received: [
                            { $match: { entry_date: { $gte: todayStart, $lte: todayEnd } } },
                            { $count: 'n' },
                        ],
                        today_finished: [
                            {
                                $match: {
                                    'currentStatus.id': { $in: [7, 8] },
                                    statusHistory: {
                                        $elemMatch: { 'toStatus.id': 7, changed_at: { $gte: todayStart, $lte: todayEnd } },
                                    },
                                },
                            },
                            { $count: 'n' },
                        ],
                        today_delivered: [
                            {
                                $match: {
                                    statusHistory: {
                                        $elemMatch: { 'toStatus.id': 8, changed_at: { $gte: todayStart, $lte: todayEnd } },
                                    },
                                },
                            },
                            { $count: 'n' },
                        ],
                        today_collected: [
                            {
                                $match: {
                                    payments: {
                                        $elemMatch: { flow_type: 'INGRESO', paid_at: { $gte: todayStart, $lte: todayEnd } },
                                    },
                                },
                            },
                            { $count: 'n' },
                        ],

                        // ── Semana ────────────────────────────────────────────────
                        week_received: [
                            { $match: { entry_date: { $gte: weekStart, $lte: todayEnd } } },
                            { $count: 'n' },
                        ],
                        week_finished: [
                            {
                                $match: {
                                    'currentStatus.id': { $in: [7, 8] },
                                    statusHistory: {
                                        $elemMatch: { 'toStatus.id': 7, changed_at: { $gte: weekStart, $lte: todayEnd } },
                                    },
                                },
                            },
                            { $count: 'n' },
                        ],
                        week_delivered: [
                            {
                                $match: {
                                    statusHistory: {
                                        $elemMatch: { 'toStatus.id': 8, changed_at: { $gte: weekStart, $lte: todayEnd } },
                                    },
                                },
                            },
                            { $count: 'n' },
                        ],
                        week_collected: [
                            {
                                $match: {
                                    payments: {
                                        $elemMatch: { flow_type: 'INGRESO', paid_at: { $gte: weekStart, $lte: todayEnd } },
                                    },
                                },
                            },
                            { $count: 'n' },
                        ],

                        // ── Mes ───────────────────────────────────────────────────
                        month_received: [
                            { $match: { entry_date: { $gte: monthStart, $lte: now } } },
                            { $count: 'n' },
                        ],
                        month_finished: [
                            {
                                $match: {
                                    'currentStatus.id': { $in: [7, 8] },
                                    statusHistory: {
                                        $elemMatch: { 'toStatus.id': 7, changed_at: { $gte: monthStart, $lte: now } },
                                    },
                                },
                            },
                            { $count: 'n' },
                        ],
                        month_delivered: [
                            {
                                $match: {
                                    statusHistory: {
                                        $elemMatch: { 'toStatus.id': 8, changed_at: { $gte: monthStart, $lte: now } },
                                    },
                                },
                            },
                            { $count: 'n' },
                        ],
                        month_collected: [
                            {
                                $match: {
                                    payments: {
                                        $elemMatch: { flow_type: 'INGRESO', paid_at: { $gte: monthStart, $lte: now } },
                                    },
                                },
                            },
                            { $count: 'n' },
                        ],
                    },
                },
            ]),
            // ── Validaciones de órdenes entregadas ───────────────────────────────────
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, 'currentStatus.id': 8 } },
                {
                    $lookup: {
                        from: 'order_validations',
                        localField: 'id',
                        foreignField: 'order_id',
                        as: 'validation',
                    },
                },
                { $unwind: { path: '$validation', preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: null,
                        checked: { $sum: { $cond: [{ $eq: ['$validation.is_checked', true] }, 1, 0] } },
                        unchecked: { $sum: { $cond: [{ $or: [{ $eq: ['$validation', null] }, { $eq: ['$validation.is_checked', false] }] }, 1, 0] } },
                    },
                },
                { $project: { _id: 0, checked: 1, unchecked: 1 } },
            ]),

        ]);

        // ── Helper para leer el $facet ────────────────────────────────────────────
        const c = (key: string): number => drillCounts[0]?.[key]?.[0]?.n ?? 0;

        // ── Globales derivados de byStatus (sin query extra) ──────────────────────
        const statusMap: Record<number, number> = Object.fromEntries(
            byStatus.map((s: any) => [s.id, s.count])
        );

        const counts = {
            today: {
                received: c('today_received'),
                finished: c('today_finished'),
                delivered: c('today_delivered'),
                collected: c('today_collected'),
            },
            week: {
                received: c('week_received'),
                finished: c('week_finished'),
                delivered: c('week_delivered'),
                collected: c('week_collected'),
            },
            month: {
                received: c('month_received'),
                finished: c('month_finished'),
                delivered: c('month_delivered'),
                collected: c('month_collected'),
            },
            global: {
                all: byStatus.reduce((s: number, r: any) => s + r.count, 0),
                pending: statusMap[1] ?? 0,   // INGRESADO
                in_progress: statusMap[6] ?? 0,   // EN_REPARACION
                waiting_approval: statusMap[4] ?? 0,   // EN_ESPERA_APROBACION
                waiting_parts: statusMap[5] ?? 0,   // EN_BUSQUEDA_REPUESTO
                finished: statusMap[7] ?? 0,   // TRABAJO_FINALIZADO
                delivered: statusMap[8] ?? 0,   // ENTREGADA
            },
            validations: {
                checked: validationCounts[0]?.checked ?? 0,
                unchecked: validationCounts[0]?.unchecked ?? 0,
            },
        };

        // ── Cálculos derivados ────────────────────────────────────────────────────
        const totalPaid = byBranch.reduce((s: number, b: any) => s + b.revenue, 0);
        const totalCost = financeData[0]?.totalProceduresCost ?? 0;
        const avgTicket = counts.global.delivered > 0
            ? +(totalPaid / counts.global.delivered).toFixed(2)
            : 0;

        return {
            periods: { today: statsDay, week: statsWeek, month: statsMonth },
            counts,
            totals: {
                all: counts.global.all,
                active: counts.global.all - counts.global.delivered,
                delivered: counts.global.delivered,
                finished: counts.global.finished,
            },
            byStatus,
            finance: {
                totalProceduresCost: totalCost,
                totalPaid,
                totalPending: totalCost - totalPaid,
                avgTicket,
            },
            byBranch,
            byTechnician,
            byOrderType,
            byDeviceBrand,
            paymentMethods,
            weeklyTrend,
            hourlyToday,
            resolutionTime: resolutionTime[0] ?? { avgDays: 0, minDays: 0, maxDays: 0 },
            validations: {
                checked: validationCounts[0]?.checked ?? 0,
                unchecked: validationCounts[0]?.unchecked ?? 0,
            },
        };
    }


    // ─────────────────────────────────────────────────────────────────────────────
    // DASHBOARD CON RANGO CUSTOM
    // ─────────────────────────────────────────────────────────────────────────────

    async getAdminDashboardRange(
        companyId: string,
        from: string,       // 'YYYY-MM-DD'
        to: string,         // 'YYYY-MM-DD'
    ): Promise<any> {

        // ── Límites UTC con corte 03:00 GYE ──────────────────────────────────────
        const rangeStart = this._gyeDayStart(from);   // from  03:00 GYE → UTC
        const rangeEnd = this._gyeDayEnd(to);        // to+1d 03:00 GYE → UTC

        // ── Todas las queries en paralelo ─────────────────────────────────────────
        const [
            byStatus,
            financeData,
            byBranch,
            byTechnician,
            weeklyTrend,
            periodStats,
            hourlyRange,
            byDeviceBrand,
            byOrderType,
            paymentMethods,
            resolutionTime,
            rangeCounts,
            validationCounts,
        ] = await Promise.all([

            // ── Por estado (órdenes ingresadas en el rango) ───────────────────────
            this.orderReplicaModel.aggregate([
                {
                    $match: {
                        'company.id': companyId,
                        entry_date: { $gte: rangeStart, $lt: rangeEnd },
                    },
                },
                {
                    $group: {
                        _id: { id: '$currentStatus.id', name: '$currentStatus.name' },
                        count: { $sum: 1 },
                    },
                },
                { $project: { _id: 0, id: '$_id.id', name: '$_id.name', count: 1 } },
                { $sort: { id: 1 } },
            ]),

            // ── Finanzas (órdenes ingresadas en el rango) ─────────────────────────
            this.orderReplicaModel.aggregate([
                {
                    $match: {
                        'company.id': companyId,
                        entry_date: { $gte: rangeStart, $lt: rangeEnd },
                    },
                },
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

            // ── Por sucursal (rango) ──────────────────────────────────────────────
            this.orderReplicaModel.aggregate([
                {
                    $match: {
                        'company.id': companyId,
                        entry_date: { $gte: rangeStart, $lt: rangeEnd },
                    },
                },
                {
                    $group: {
                        _id: { id: '$branch.id', name: '$branch.name' },
                        total: { $sum: 1 },
                        delivered: {
                            $sum: { $cond: [{ $eq: ['$currentStatus.id', 8] }, 1, 0] },
                        },
                        revenue: {
                            $sum: {
                                $reduce: {
                                    input: '$payments', initialValue: 0,
                                    in: {
                                        $add: [
                                            '$$value',
                                            { $cond: [{ $eq: ['$$this.flow_type', 'INGRESO'] }, '$$this.amount', 0] },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        branchId: '$_id.id', branchName: '$_id.name',
                        total: 1, delivered: 1, revenue: 1,
                    },
                },
                { $sort: { total: -1 } },
            ]),

            // ── Top 10 técnicos (rango) ───────────────────────────────────────────
            this.orderReplicaModel.aggregate([
                {
                    $match: {
                        'company.id': companyId,
                        entry_date: { $gte: rangeStart, $lt: rangeEnd },
                        'technicians.0': { $exists: true },
                    },
                },
                { $unwind: '$technicians' },
                {
                    $group: {
                        _id: '$technicians.id',
                        name: {
                            $first: {
                                $concat: ['$technicians.first_name', ' ', '$technicians.last_name'],
                            },
                        },
                        total: { $sum: 1 },
                        resolved: {
                            $sum: { $cond: [{ $in: ['$currentStatus.id', [7, 8]] }, 1, 0] },
                        },
                    },
                },
                { $project: { _id: 0, techId: '$_id', name: 1, total: 1, resolved: 1 } },
                { $sort: { total: -1 } },
                { $limit: 10 },
            ]),

            // ── Tendencia diaria del rango (reemplaza weeklyTrend) ────────────────
            this.orderReplicaModel.aggregate([
                {
                    $match: {
                        'company.id': companyId,
                        entry_date: { $gte: rangeStart, $lt: rangeEnd },
                    },
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$entry_date',
                                timezone: 'America/Guayaquil',
                            },
                        },
                        ingresadas: { $sum: 1 },
                        entregadas: {
                            $sum: { $cond: [{ $eq: ['$currentStatus.id', 8] }, 1, 0] },
                        },
                        revenue: {
                            $sum: {
                                $reduce: {
                                    input: '$payments', initialValue: 0,
                                    in: {
                                        $add: [
                                            '$$value',
                                            { $cond: [{ $eq: ['$$this.flow_type', 'INGRESO'] }, '$$this.amount', 0] },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
                { $project: { _id: 0, date: '$_id', ingresadas: 1, entregadas: 1, revenue: 1 } },
                { $sort: { date: 1 } },
            ]),

            // ── Estadísticas del período (cobrado + pagos) ────────────────────────
            // Reutiliza el helper existente con los límites del rango
            this._periodStats(companyId, rangeStart, rangeEnd),

            // ── Distribución horaria del rango ────────────────────────────────────
            // Para rangos cortos (1-3 días) es muy útil; para rangos largos sirve
            // para ver qué horas son más activas en promedio
            this.orderReplicaModel.aggregate([
                {
                    $match: {
                        'company.id': companyId,
                        entry_date: { $gte: rangeStart, $lt: rangeEnd },
                    },
                },
                {
                    $group: {
                        _id: {
                            $hour: { date: '$entry_date', timezone: 'America/Guayaquil' },
                        },
                        count: { $sum: 1 },
                        revenue: {
                            $sum: {
                                $reduce: {
                                    input: '$payments', initialValue: 0,
                                    in: {
                                        $add: [
                                            '$$value',
                                            { $cond: [{ $eq: ['$$this.flow_type', 'INGRESO'] }, '$$this.amount', 0] },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
                { $project: { _id: 0, hour: '$_id', count: 1, revenue: 1 } },
                { $sort: { hour: 1 } },
            ]),

            // ── Top 8 marcas (rango) ──────────────────────────────────────────────
            this.orderReplicaModel.aggregate([
                {
                    $match: {
                        'company.id': companyId,
                        entry_date: { $gte: rangeStart, $lt: rangeEnd },
                        'device.model.brand_name': { $exists: true, $ne: null },
                    },
                },
                {
                    $group: {
                        _id: { id: '$device.model.brand_id', name: '$device.model.brand_name' },
                        total: { $sum: 1 },
                    },
                },
                { $project: { _id: 0, brandId: '$_id.id', brandName: '$_id.name', total: 1 } },
                { $sort: { total: -1 } },
                { $limit: 8 },
            ]),

            // ── Por tipo de orden (rango) ─────────────────────────────────────────
            this.orderReplicaModel.aggregate([
                {
                    $match: {
                        'company.id': companyId,
                        entry_date: { $gte: rangeStart, $lt: rangeEnd },
                    },
                },
                {
                    $group: {
                        _id: { id: '$type.id', name: '$type.name' },
                        count: { $sum: 1 },
                    },
                },
                { $project: { _id: 0, typeId: '$_id.id', typeName: '$_id.name', count: 1 } },
                { $sort: { count: -1 } },
            ]),

            // ── Métodos de pago (pagos realizados en el rango) ────────────────────
            // Nota: filtra por paid_at, no por entry_date, para capturar cobros
            // de órdenes antiguas pagadas dentro del rango
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                { $unwind: '$payments' },
                {
                    $match: {
                        'payments.flow_type': 'INGRESO',
                        'payments.paid_at': { $gte: rangeStart, $lt: rangeEnd },
                    },
                },
                {
                    $group: {
                        _id: {
                            id: '$payments.payment_method_id',
                            name: '$payments.payment_method_name',
                        },
                        total: { $sum: '$payments.amount' },
                        count: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        methodId: '$_id.id', methodName: '$_id.name',
                        total: 1, count: 1,
                    },
                },
                { $sort: { total: -1 } },
            ]),

            // ── Tiempo promedio de resolución (órdenes del rango) ─────────────────
            this.orderReplicaModel.aggregate([
                {
                    $match: {
                        'company.id': companyId,
                        entry_date: { $gte: rangeStart, $lt: rangeEnd },
                        'currentStatus.id': { $in: [7, 8] },
                    },
                },
                { $unwind: '$statusHistory' },
                { $match: { 'statusHistory.toStatus.id': { $in: [7, 8] } } },
                {
                    $group: {
                        _id: '$_id',
                        entry_date: { $first: '$entry_date' },
                        resolved_at: { $max: '$statusHistory.changed_at' },
                    },
                },
                {
                    $project: {
                        diffDays: {
                            $divide: [{ $subtract: ['$resolved_at', '$entry_date'] }, 86_400_000],
                        },
                    },
                },
                {
                    $group: {
                        _id: null,
                        avgDays: { $avg: '$diffDays' },
                        minDays: { $min: '$diffDays' },
                        maxDays: { $max: '$diffDays' },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        avgDays: { $round: ['$avgDays', 1] },
                        minDays: { $round: ['$minDays', 1] },
                        maxDays: { $round: ['$maxDays', 1] },
                    },
                },
            ]),

            // ── Conteos del rango ($facet = 1 sola round-trip) ───────────────────
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                {
                    $facet: {

                        // Ingresadas: entry_date dentro del rango
                        range_received: [
                            { $match: { entry_date: { $gte: rangeStart, $lt: rangeEnd } } },
                            { $count: 'n' },
                        ],

                        // Terminadas: alcanzaron estado 7 dentro del rango
                        range_finished: [
                            {
                                $match: {
                                    'currentStatus.id': { $in: [7, 8] },
                                    statusHistory: {
                                        $elemMatch: {
                                            'toStatus.id': 7,
                                            changed_at: { $gte: rangeStart, $lt: rangeEnd },
                                        },
                                    },
                                },
                            },
                            { $count: 'n' },
                        ],

                        // Entregadas: alcanzaron estado 8 dentro del rango
                        range_delivered: [
                            {
                                $match: {
                                    statusHistory: {
                                        $elemMatch: {
                                            'toStatus.id': 8,
                                            changed_at: { $gte: rangeStart, $lt: rangeEnd },
                                        },
                                    },
                                },
                            },
                            { $count: 'n' },
                        ],

                        // Cobros: tiene al menos 1 pago INGRESO en el rango
                        range_payments_count: [
                            {
                                $match: {
                                    payments: {
                                        $elemMatch: {
                                            flow_type: 'INGRESO',
                                            paid_at: { $gte: rangeStart, $lt: rangeEnd },
                                        },
                                    },
                                },
                            },
                            { $count: 'n' },
                        ],

                    },
                },
            ]),
            // ── Validaciones de órdenes entregadas ───────────────────────────────────
            // ── Validaciones de órdenes entregadas ───────────────────────────────────
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, 'currentStatus.id': 8 } },
                {
                    $lookup: {
                        from: 'order_validations',
                        localField: 'id',
                        foreignField: 'order_id',
                        as: 'validation',
                    },
                },
                { $unwind: { path: '$validation', preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: null,
                        checked: { $sum: { $cond: [{ $eq: ['$validation.is_checked', true] }, 1, 0] } },
                        unchecked: { $sum: { $cond: [{ $or: [{ $eq: ['$validation', null] }, { $eq: ['$validation.is_checked', false] }] }, 1, 0] } },
                    },
                },
                { $project: { _id: 0, checked: 1, unchecked: 1 } },
            ]),

        ]);

        // ── Helper para leer el $facet ────────────────────────────────────────────
        const c = (key: string): number => rangeCounts[0]?.[key]?.[0]?.n ?? 0;

        // ── Globales derivados de byStatus ────────────────────────────────────────
        const statusMap: Record<number, number> = Object.fromEntries(
            byStatus.map((s: any) => [s.id, s.count])
        );

        // ── Finanzas del rango ────────────────────────────────────────────────────
        const totalPaid = byBranch.reduce((s: number, b: any) => s + b.revenue, 0);
        const totalCost = financeData[0]?.totalProceduresCost ?? 0;
        const rangeDelivered = c('range_delivered');
        const avgTicket = rangeDelivered > 0
            ? +(totalPaid / rangeDelivered).toFixed(2)
            : 0;

        const counts = {
            range: {
                received: c('range_received'),
                finished: c('range_finished'),
                delivered: rangeDelivered,
                collected: c('range_payments_count'),
            },
            // global sigue siendo útil para los KPI de estado actual
            global: {
                all: byStatus.reduce((s: number, r: any) => s + r.count, 0),
                pending: statusMap[1] ?? 0,
                in_progress: statusMap[6] ?? 0,
                waiting_approval: statusMap[4] ?? 0,
                waiting_parts: statusMap[5] ?? 0,
                finished: statusMap[7] ?? 0,
                delivered: statusMap[8] ?? 0,
            },
        };

        return {
            // ── Mismos nombres que el dashboard normal → frontend no cambia ───────
            periods: { range: periodStats },
            counts,
            byStatus,
            finance: {
                totalProceduresCost: totalCost,
                totalPaid,
                totalPending: totalCost - totalPaid,
                avgTicket,
            },
            byBranch,
            byTechnician,
            byOrderType,
            byDeviceBrand,
            paymentMethods,
            weeklyTrend: weeklyTrend,      // tendencia diaria del rango
            hourlyToday: hourlyRange,       // mismo nombre → chart funciona igual
            resolutionTime: resolutionTime[0] ?? { avgDays: 0, minDays: 0, maxDays: 0 },
            // Metadata útil para mostrar en el frontend
            meta: {
                from,
                to,
                rangeStart: rangeStart.toISOString(),
                rangeEnd: rangeEnd.toISOString(),
            },
            validations: {
                checked: validationCounts[0]?.checked ?? 0,
                unchecked: validationCounts[0]?.unchecked ?? 0,
            },
        };
    }
}