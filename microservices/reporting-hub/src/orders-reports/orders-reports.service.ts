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
import { DRILL_CARD_KEYS, DrillCardKey } from './constants/drill-cards.constants';
import { OrderValidation, OrderValidationDocument } from '../order-validation/schemas/order-validation.schema';
import { EmployeeCommission, EmployeeCommissionDocument } from '../users-employees-events/schemas/employee-commission.schema';
import { buildCommissionQueries, calculateCommissions, hasActiveCommissions } from './helpers/commission.helper';

// ─── Helpers externos ─────────────────────────────────────────────────────────
import {
    TZ,
    _nowInTZ,
    _midnightUTC,
    _gyeDayStart,
    _gyeDayEnd,
    _dayBoundaries,
    _currentWeekBoundaries,
    _lastWeekBoundaries,
    _monthBoundaries,
} from './helpers/date-time.helpers';
import { DAY_NAMES, buildWeekDays } from './helpers/dashboard-data.helpers';
import { CASHIER_PENDING_STATUS_IDS, CASHIER_DELIVERED_STATUS_ID, SERVICE_TECNICO_TYPE_ID } from './helpers/cashier-dashboard.constants';
// ── Constantes de este dashboard ──────────────────────────────────────

type SortMode = 'entry_date' | 'finalized_at' | 'delivered_at' | 'last_paid_at';
export const ORDER_STATUS = {
    INGRESADO: 1,
    VISTA: 2,
    EN_REVISION: 3,
    EN_ESPERA_APROBACION: 4,
    EN_BUSQUEDA_REPUESTO: 5,
    EN_REPARACION: 6,
    TRABAJO_FINALIZADO: 7,
    ENTREGADA: 8,
} as const;
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

        @InjectModel(OrderValidation.name)
        private orderValidationModel: Model<OrderValidationDocument>,

        @InjectModel(EmployeeCommission.name)
        private readonly employeeCommissionModel: Model<EmployeeCommissionDocument>,
    ) { }

    // ─────────────────────────────────────────────────────────────────────────
    // DRILL (tarjetas del dashboard)
    // ─────────────────────────────────────────────────────────────────────────

    async getDashboardDrill(
        companyId: string,
        card: string,
        page: number,
        limit: number,
    ): Promise<{ data: any[]; total: number }> {

        const { todayStart, todayEnd } = _dayBoundaries();

        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 6);

        const GYE_OFFSET_MS = -5 * 60 * 60 * 1000;
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

        const SORT_MODE_MAP: Record<string, SortMode> = {
            today_received: 'entry_date', week_received: 'entry_date',
            month_received: 'entry_date', range_received: 'entry_date',
            today_finished: 'finalized_at', week_finished: 'finalized_at',
            month_finished: 'finalized_at', range_finished: 'finalized_at',
            today_delivered: 'delivered_at', week_delivered: 'delivered_at',
            month_delivered: 'delivered_at', range_delivered: 'delivered_at',
            global_delivered: 'delivered_at',
            today_collected: 'last_paid_at', week_collected: 'last_paid_at',
            month_collected: 'last_paid_at', range_collected: 'last_paid_at',
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
            sortMode === 'delivered_at' || isValidationCard,
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

        const addFieldsStage: PipelineStage[] = (() => {
            switch (sortMode) {
                case 'delivered_at':
                    return [{ $addFields: { _sort_date: { $max: { $map: { input: { $filter: { input: { $ifNull: ['$statusHistory', []] }, as: 'h', cond: { $eq: ['$$h.toStatus.id', 8] } } }, as: 'h', in: '$$h.changed_at' } } } } }];
                case 'finalized_at':
                    return [{ $addFields: { _sort_date: { $max: { $map: { input: { $filter: { input: { $ifNull: ['$statusHistory', []] }, as: 'h', cond: { $eq: ['$$h.toStatus.id', 7] } } }, as: 'h', in: '$$h.changed_at' } } } } }];
                case 'last_paid_at':
                    return [{ $addFields: { _sort_date: { $max: { $map: { input: { $filter: { input: { $ifNull: ['$payments', []] }, as: 'p', cond: { $eq: ['$$p.flow_type', 'INGRESO'] } } }, as: 'p', in: '$$p.paid_at' } } } } }];
                default:
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
                id: order.id, order_number: order.order_number,
                revisadoAntes: order.revisadoAntes, currentStatus: order.currentStatus,
                type: order.type, branch: order.branch, customer: order.customer,
                device: order.device,
                technicians: order.technicians?.map(t => ({ id: t.id, first_name: t.first_name, last_name: t.last_name })) ?? [],
                entry_date: order.entry_date, finalized_at: finalizedAt, completed_at: completedAt,
                estimated_price: order.estimated_price ?? null,
                total_procedures_cost: totalProceduresCost, total_paid: totalPaid,
                findings_summary: findingsSummary, has_active_warranty: hasActiveWarranty,
                validation,
            };
        });

        return { data, total };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // METADATA DE FILTROS
    // ─────────────────────────────────────────────────────────────────────────

    async getOrderFiltersMetadata(companyId: string) {
        const [statuses, types, company, employees] = await Promise.all([
            this.orderStatusModel.find().select('id name').sort({ id: 1 }).lean(),
            this.orderTypeModel.find().select('id name').sort({ id: 1 }).lean(),
            this.companyReplicaModel.findOne({ id: companyId }).select('branches').lean(),
            this.userEmployeeCacheModel.find({ companyId }).select('id first_name last_name username groups').lean(),
        ]);

        const branches = company?.branches || [];
        const technicians = employees.filter(emp =>
            emp.groups.some(g => ['TECHNICIANS', 'CSRSPER'].includes(g.group_name.toUpperCase()))
        );
        const cashiers = employees.filter(emp =>
            emp.groups.some(g => ['CASHIERS'].includes(g.group_name.toUpperCase()))
        );

        return {
            orderStatuses: statuses.map(s => ({ id: s.id, name: s.name })),
            orderTypes: types.map(t => ({ id: t.id, name: t.name })),
            branches: branches.map(b => ({ id: b.id, name: b.name })),
            technicians: technicians.map(t => ({ id: t.id, name: `${t.first_name} ${t.last_name}`.trim() || t.username })),
            cashiers: cashiers.map(c => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim() || c.username })),
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LISTA DE ÓRDENES
    // ─────────────────────────────────────────────────────────────────────────

    async getOrdersList(companyId: string, dto: GetOrdersFilterDto): Promise<{ data: any[]; total: number }> {
        const filter = this.buildMongoFilter(companyId, dto);

        const [raw, total] = await Promise.all([
            this.orderReplicaModel
                .find(filter)
                .select({
                    id: 1, order_number: 1,
                    previous_order_id: 1, revisadoAntes: 1,
                    is_national: 1,
                    currentStatus: 1, type: 1, branch: 1,
                    customer: 1, device: 1, technicians: 1,
                    entry_date: 1, estimated_price: 1,
                    statusHistory: 1, findings: 1, payments: 1
                })
                .sort({ entry_date: -1 })
                .lean(),
            this.orderReplicaModel.countDocuments(filter),
        ]);

        const now = new Date();
        const data = raw.map((order): any => {
            const finalizedAt = order.statusHistory
                ?.filter(h => h.toStatus?.id === 7)
                .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
            [0]?.changed_at ?? null;

            const completedAt = order.statusHistory
                ?.filter(h => h.toStatus?.id === 8)
                .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
            [0]?.changed_at ?? null;

            const totalProceduresCost = order.findings?.reduce((sumF, finding) =>
                sumF + (finding.procedures?.reduce((sumP, proc) =>
                    sumP + (proc.is_active ? (proc.procedure_cost ?? 0) : 0), 0) ?? 0), 0) ?? 0;

            const totalPaid = order.payments?.reduce((sum, p) =>
                sum + (p.flow_type === 'INGRESO' ? (p.amount ?? 0) : 0), 0) ?? 0;

            const hasActiveWarranty = order.findings?.some(finding =>
                finding.procedures?.some(proc => {
                    if (!proc.is_active || !proc.warranty_days || proc.warranty_days <= 0) return false;
                    if (!completedAt) return true;
                    const expiresAt = new Date(completedAt);
                    expiresAt.setDate(expiresAt.getDate() + proc.warranty_days);
                    return expiresAt > now;
                }),
            ) ?? false;

            const device = order.device ? {
                model: order.device.model?.models_name,
                brand: order.device.model?.brand_name,
                type: order.device.type?.name,
            } : undefined;

            const findings = order.findings?.map(f => ({
                id: f.id,
                description: f.description,
                is_active: f.is_active,
                is_resolved: f.is_resolved,
                procedures: f.procedures ?? [],
            })) ?? [];

            return {
                id: order.id, order_number: order.order_number,
                revisadoAntes: order.revisadoAntes, currentStatus: order.currentStatus,
                is_national: order.is_national ?? false,
                type: order.type,
                branch: { id: order.branch.id, name: order.branch.name },
                customer: { id: order.customer.id, firstName: order.customer.firstName, lastName: order.customer.lastName },
                device,
                technicians: order.technicians?.map(t => ({ id: t.id, first_name: t.first_name, last_name: t.last_name })) ?? [],
                entry_date: order.entry_date, finalized_at: finalizedAt, completed_at: completedAt,
                estimated_price: order.estimated_price ?? null,
                total_procedures_cost: totalProceduresCost, total_paid: totalPaid,
                findings, has_active_warranty: hasActiveWarranty,
            };
        });

        return { data, total };
    }

    buildMongoFilter(companyId: string, dto: GetOrdersFilterDto): Record<string, any> {
        const filter: Record<string, any> = { 'company.id': companyId };

        if (dto.status?.length) filter['currentStatus.id'] = { $in: dto.status.map(Number) };
        if (dto.orderType?.length) filter['type.id'] = { $in: dto.orderType.map(Number) };
        if (dto.branch?.length) filter['branch.id'] = { $in: dto.branch };
        if (dto.technician?.length) {
            filter['findings.procedures.performedBy.id'] = { $in: dto.technician };
        }
        if (dto.receptionist?.length) filter['createdBy.id'] = { $in: dto.receptionist };

        const ingresoRange = this._resolveDateRange(dto.periodMode, dto.presetPeriod, dto.dateFrom, dto.dateTo);
        if (ingresoRange) filter['entry_date'] = ingresoRange;

        const endRange = this._resolveDateRange(dto.endPeriodMode, dto.endPresetPeriod, dto.endDateFrom, dto.endDateTo);
        if (endRange) {
            filter['statusHistory'] = { $elemMatch: { 'toStatus.id': 7, changed_at: endRange } };
        }

        const deliveryRange = this._resolveDateRange(dto.deliveryPeriodMode, dto.deliveryPresetPeriod, dto.deliveryDateFrom, dto.deliveryDateTo);
        if (deliveryRange) {
            if (filter['statusHistory']) {
                filter['statusHistory'] = {
                    $all: [
                        { $elemMatch: filter['statusHistory'].$elemMatch },
                        { $elemMatch: { 'toStatus.id': 8, changed_at: deliveryRange } },
                    ],
                };
            } else {
                filter['statusHistory'] = { $elemMatch: { 'toStatus.id': 8, changed_at: deliveryRange } };
            }
        }

        return filter;
    }

    private _resolveDateRange(
        mode?: 'preset' | 'custom',
        preset?: string,
        from?: string,
        to?: string,
    ): Record<string, Date> | null {
        const gyeStart = (y: number, m: number, d: number) =>
            new Date(Date.UTC(y, m - 1, d, 5, 0, 0, 0));
        const gyeEnd = (y: number, m: number, d: number) =>
            new Date(Date.UTC(y, m - 1, d + 1, 4, 59, 59, 999));

        if (mode === 'preset' && preset) {
            const [y, m] = preset.split('-').map(Number);
            return {
                $gte: gyeStart(y, m, 1),
                $lt: gyeStart(y, m + 1, 1),
            };
        }

        if (mode === 'custom' && (from || to)) {
            const range: Record<string, Date> = {};

            if (from) {
                const d = new Date(from);
                if (!isNaN(d.getTime())) range.$gte = d;  // ya viene con TZ del frontend
            }
            if (to) {
                const d = new Date(to);
                if (!isNaN(d.getTime())) {
                    // Si viene con hora (ISO completo), usar directo
                    // Si viene solo fecha YYYY-MM-DD, ajustar al fin del día GYE
                    const hasTime = to.includes('T');
                    if (hasTime) {
                        range.$lte = d;
                    } else {
                        const [y, m, day] = to.split('-').map(Number);
                        range.$lte = gyeEnd(y, m, day);
                    }
                }
            }

            return Object.keys(range).length ? range : null;
        }

        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DETALLE DE ORDEN
    // ─────────────────────────────────────────────────────────────────────────

    async getOrderDetail(companyId: string, orderId: number) {
        const order = await this.orderReplicaModel
            .findOne({ id: orderId, 'company.id': companyId })
            .lean();

        if (!order) throw new RpcException({ statusCode: 404, message: 'Orden no encontrada' });
        return order;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DASHBOARD (entry point)
    // ─────────────────────────────────────────────────────────────────────────

    async getDashboard(companyId: string, userId: string, groups: string[]): Promise<any> {

        const isAdmin = groups.some(g => ['COMPANY_ADMIN', 'ADMINS', 'IFE'].includes(g));
        const isTechnician = groups.some(g => ['TECHNICIANS', 'CSRSPER'].includes(g));
        const isCashier = groups.includes('CASHIERS');

        const [technician, cashier, admin] = await Promise.all([
            isTechnician ? this._getTechnicianDashboard(companyId, userId) : Promise.resolve(undefined),
            isCashier ? this._getCashierDashboard(companyId, userId) : Promise.resolve(undefined),
            isAdmin ? this._getAdminDashboard(companyId) : Promise.resolve(undefined),
        ]);

        return { groups, technician, cashier, admin };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DASHBOARD TÉCNICO
    // ─────────────────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────────────────────
    // Fragmento de service: _getTechnicianDashboard()
    // Reemplaza la versión anterior completa de este método.
    // ─────────────────────────────────────────────────────────────────────────────

    private async _getTechnicianDashboard(companyId: string, userId: string): Promise<any> {

        const RESOLVED_IDS = [ORDER_STATUS.TRABAJO_FINALIZADO, ORDER_STATUS.ENTREGADA];
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const baseProcedureMatch = {
            'company.id': companyId,
            'findings.procedures.performedBy.id': userId,
        };

        // ── 1. Obtener esquema de comisiones primero (necesario para buildCommissionQueries) ──
        const employeeCommission = await this.employeeCommissionModel
            .findOne({ employeeId: userId })
            .lean();

        const commissions = employeeCommission?.commissions ?? [];
        const technicianHasCommissions = hasActiveCommissions(commissions);

        // ── 2. Construir queries dinámicas por comisión × período ─────────────────
        const commissionDescriptors = technicianHasCommissions
            ? buildCommissionQueries(companyId, userId, commissions)
            : [];

        // ── 3. Ejecutar todo en paralelo ──────────────────────────────────────────
        const [
            finalizedTodayCount,
            assignmentsData,
            ...commissionQueryResults
        ] = await Promise.all([

            // Finalizaciones de hoy
            this.orderReplicaModel.countDocuments({
                ...baseProcedureMatch,
                'currentStatus.id': { $in: RESOLVED_IDS },
                statusHistory: {
                    $elemMatch: {
                        'toStatus.id': ORDER_STATUS.TRABAJO_FINALIZADO,
                        changed_at: { $gte: startOfToday },
                    },
                },
            }),

            // Asignaciones de hoy + activas/pendientes acumuladas
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, 'technicians.id': userId } },
                {
                    $group: {
                        _id: null,
                        today: {
                            $sum: { $cond: [{ $gte: ['$entry_date', startOfToday] }, 1, 0] },
                        },
                        activePending: {
                            $sum: { $cond: [{ $not: { $in: ['$currentStatus.id', RESOLVED_IDS] } }, 1, 0] },
                        },
                    },
                },
                { $project: { _id: 0, today: 1, activePending: 1 } },
            ]),

            // Queries de comisiones: una por comisión activa × período (today/week/month)
            ...commissionDescriptors.map(descriptor =>
                this.orderReplicaModel
                    .find(descriptor.filter, descriptor.projection)
                    .lean()
                    .then(orders => ({
                        period: descriptor.period,
                        commissionType: descriptor.commissionType,
                        targetId: descriptor.targetId,
                        orders,
                    }))
            ),
        ]);

        // ── 4. Calcular comisiones ────────────────────────────────────────────────
        const assignments = assignmentsData[0] ?? { today: 0, activePending: 0 };
        const commissionData = technicianHasCommissions
            ? calculateCommissions(userId, commissions, commissionQueryResults)
            : null;

        // ── 5. Respuesta (estructura idéntica al frontend, sin allTime) ───────────
        return {
            summary: {
                assignedToday: assignments.today,
                finalizedToday: finalizedTodayCount,
                activePending: assignments.activePending,
            },
            hasCommissions: technicianHasCommissions,
            commissions: commissionData
                ? {
                    today: { total: commissionData.today.totalAmount, entries: commissionData.today.entries },
                    week: { total: commissionData.week.totalAmount, entries: commissionData.week.entries },
                    month: { total: commissionData.month.totalAmount, entries: commissionData.month.entries },
                }
                : null,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DASHBOARD CAJERO
    // ─────────────────────────────────────────────────────────────────────────



    // ── Helper: ingresadas Y entregadas, ambas filtradas a Servicio Técnico ──
    private async _cashierPeriodStats(companyId: string, userId: string, from: Date, to: Date) {
        const [result] = await this.orderReplicaModel.aggregate([
            { $match: { 'company.id': companyId, 'createdBy.id': userId, 'type.id': SERVICE_TECNICO_TYPE_ID } },
            {
                $facet: {
                    ingresadas: [
                        { $match: { entry_date: { $gte: from, $lt: to } } },
                        { $count: 'n' },
                    ],
                    entregadas: [
                        {
                            $match: {
                                statusHistory: {
                                    $elemMatch: { 'toStatus.id': CASHIER_DELIVERED_STATUS_ID, changed_at: { $gte: from, $lt: to } },
                                },
                            },
                        },
                        { $count: 'n' },
                    ],
                },
            },
        ]);

        return {
            ingresadas: result?.ingresadas?.[0]?.n ?? 0,
            entregadas: result?.entregadas?.[0]?.n ?? 0,
        };
    }
    // ── Helper: pendientes actuales, solo Servicio Técnico ──────────────────
    private async _cashierPendingNow(companyId: string, userId: string) {
        const pendingNow = await this.orderReplicaModel.aggregate([
            {
                $match: {
                    'company.id': companyId,
                    'createdBy.id': userId,
                    'type.id': SERVICE_TECNICO_TYPE_ID,
                    'currentStatus.id': { $in: CASHIER_PENDING_STATUS_IDS },
                },
            },
            { $group: { _id: '$currentStatus.id', count: { $sum: 1 }, statusName: { $first: '$currentStatus.name' } } },
            { $sort: { _id: 1 } },
        ]);

        const total = pendingNow.reduce((s: number, g: any) => s + g.count, 0);
        const byStatus = pendingNow.map((g: any) => ({ statusId: g._id, statusName: g.statusName, count: g.count }));

        return { total, byStatus };
    }

    // ── Dashboard normal: Hoy / Semana / Mes ────────────────────────────────
    private async _getCashierDashboard(companyId: string, userId: string): Promise<any> {
        const { todayStart, todayEnd } = _dayBoundaries();

        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 6);

        const GYE_OFFSET_MS = -5 * 60 * 60 * 1000;
        const localNow = new Date(Date.now() + GYE_OFFSET_MS);
        const monthStartLocal = new Date(localNow.getFullYear(), localNow.getMonth(), 1, 3, 0, 0, 0);
        const monthStart = new Date(monthStartLocal.getTime() - GYE_OFFSET_MS);
        const now = new Date();

        const [today, week, month, pending] = await Promise.all([
            this._cashierPeriodStats(companyId, userId, todayStart, todayEnd),
            this._cashierPeriodStats(companyId, userId, weekStart, todayEnd),
            this._cashierPeriodStats(companyId, userId, monthStart, now),
            this._cashierPendingNow(companyId, userId),
        ]);

        return {
            periods: { today, week, month },
            pending,
        };
    }

    // ── Dashboard por rango de fechas (mismo patrón que admin) ──────────────
    async getCashierDashboardRange(companyId: string, userId: string, from: string, to: string): Promise<any> {
        const rangeStart = _gyeDayStart(from);
        const rangeEnd = _gyeDayEnd(to);

        const [range, pending] = await Promise.all([
            this._cashierPeriodStats(companyId, userId, rangeStart, rangeEnd),
            this._cashierPendingNow(companyId, userId),
        ]);

        return {
            periods: { range },
            pending,
            meta: { from, to, rangeStart: rangeStart.toISOString(), rangeEnd: rangeEnd.toISOString() },
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPER DE PERÍODO (stats para admin)
    // ─────────────────────────────────────────────────────────────────────────

    private async _periodStats(companyId: string, from: Date, to: Date) {
        const [orders, payments] = await Promise.all([
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, entry_date: { $gte: from, $lt: to } } },
                { $group: { _id: null, received: { $sum: 1 }, finished: { $sum: { $cond: [{ $in: ['$currentStatus.id', [7, 8]] }, 1, 0] } }, delivered: { $sum: { $cond: [{ $eq: ['$currentStatus.id', 8] }, 1, 0] } } } },
            ]),
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                { $unwind: '$payments' },
                { $match: { 'payments.flow_type': 'INGRESO', 'payments.paid_at': { $gte: from, $lt: to } } },
                { $group: { _id: null, collected: { $sum: '$payments.amount' }, paymentsCount: { $sum: 1 } } },
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

    // ─────────────────────────────────────────────────────────────────────────
    // DASHBOARD ADMIN
    // ─────────────────────────────────────────────────────────────────────────

    private async _getAdminDashboard(companyId: string): Promise<any> {
        const { todayStart, todayEnd } = _dayBoundaries();

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
            byStatus, financeData, byBranch, byTechnician, weeklyTrendRaw,
            [statsDay, statsWeek, statsMonth],
            hourlyTodayRaw, byDeviceBrand, byOrderType, paymentMethods,
            resolutionTime, drillCounts, validationCounts,
            byTypeStatus, byTypeFinance, byTypeMoney,
        ] = await Promise.all([

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                { $group: { _id: { id: '$currentStatus.id', name: '$currentStatus.name' }, count: { $sum: 1 } } },
                { $project: { _id: 0, id: '$_id.id', name: '$_id.name', count: 1 } },
                { $sort: { id: 1 } },
            ]),

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                { $unwind: { path: '$findings', preserveNullAndEmptyArrays: true } },
                { $unwind: { path: '$findings.procedures', preserveNullAndEmptyArrays: true } },
                { $group: { _id: null, totalProceduresCost: { $sum: { $cond: [{ $eq: ['$findings.procedures.is_active', true] }, { $ifNull: ['$findings.procedures.procedure_cost', 0] }, 0] } } } },
            ]),

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                { $group: { _id: { id: '$branch.id', name: '$branch.name' }, total: { $sum: 1 }, delivered: { $sum: { $cond: [{ $eq: ['$currentStatus.id', 8] }, 1, 0] } }, revenue: { $sum: { $reduce: { input: '$payments', initialValue: 0, in: { $add: ['$$value', { $cond: [{ $eq: ['$$this.flow_type', 'INGRESO'] }, '$$this.amount', 0] }] } } } } } },
                { $project: { _id: 0, branchId: '$_id.id', branchName: '$_id.name', total: 1, delivered: 1, revenue: 1 } },
                { $sort: { total: -1 } },
            ]),

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, 'technicians.0': { $exists: true } } },
                { $unwind: '$technicians' },
                { $group: { _id: '$technicians.id', name: { $first: { $concat: ['$technicians.first_name', ' ', '$technicians.last_name'] } }, total: { $sum: 1 }, resolved: { $sum: { $cond: [{ $in: ['$currentStatus.id', [7, 8]] }, 1, 0] } } } },
                { $project: { _id: 0, techId: '$_id', name: 1, total: 1, resolved: 1 } },
                { $sort: { total: -1 } }, { $limit: 10 },
            ]),

            // ── weeklyTrend: ahora desglosado también por type.id ──────────────
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, entry_date: { $gte: since4w } } },
                {
                    $group: {
                        _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$entry_date', timezone: 'America/Guayaquil' } }, typeId: '$type.id' },
                        ingresadas: { $sum: 1 },
                        entregadas: { $sum: { $cond: [{ $eq: ['$currentStatus.id', 8] }, 1, 0] } },
                        revenue: { $sum: { $reduce: { input: '$payments', initialValue: 0, in: { $add: ['$$value', { $cond: [{ $eq: ['$$this.flow_type', 'INGRESO'] }, '$$this.amount', 0] }] } } } },
                    },
                },
                { $project: { _id: 0, date: '$_id.date', typeId: '$_id.typeId', ingresadas: 1, entregadas: 1, revenue: 1 } },
                { $sort: { date: 1 } },
            ]),

            Promise.all([
                this._periodStats(companyId, todayStart, todayEnd),
                this._periodStats(companyId, weekStart, todayEnd),
                this._periodStats(companyId, monthStart, now),
            ]),

            // ── hourlyToday: ahora desglosado también por type.id ──────────────
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, entry_date: { $gte: todayStart, $lt: todayEnd } } },
                {
                    $group: {
                        _id: { hour: { $hour: { date: '$entry_date', timezone: 'America/Guayaquil' } }, typeId: '$type.id' },
                        count: { $sum: 1 },
                        revenue: { $sum: { $reduce: { input: '$payments', initialValue: 0, in: { $add: ['$$value', { $cond: [{ $eq: ['$$this.flow_type', 'INGRESO'] }, '$$this.amount', 0] }] } } } },
                    },
                },
                { $project: { _id: 0, hour: '$_id.hour', typeId: '$_id.typeId', count: 1, revenue: 1 } },
                { $sort: { hour: 1 } },
            ]),

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, 'device.model.brand_name': { $exists: true, $ne: null } } },
                { $group: { _id: { id: '$device.model.brand_id', name: '$device.model.brand_name' }, total: { $sum: 1 } } },
                { $project: { _id: 0, brandId: '$_id.id', brandName: '$_id.name', total: 1 } },
                { $sort: { total: -1 } }, { $limit: 8 },
            ]),

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                { $group: { _id: { id: '$type.id', name: '$type.name' }, count: { $sum: 1 } } },
                { $project: { _id: 0, typeId: '$_id.id', typeName: '$_id.name', count: 1 } },
                { $sort: { count: -1 } },
            ]),

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                { $unwind: '$payments' },
                { $match: { 'payments.flow_type': 'INGRESO' } },
                { $group: { _id: { id: '$payments.payment_method_id', name: '$payments.payment_method_name' }, total: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
                { $project: { _id: 0, methodId: '$_id.id', methodName: '$_id.name', total: 1, count: 1 } },
                { $sort: { total: -1 } },
            ]),

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, 'currentStatus.id': { $in: [7, 8] } } },
                { $unwind: '$statusHistory' },
                { $match: { 'statusHistory.toStatus.id': { $in: [7, 8] } } },
                { $group: { _id: '$_id', entry_date: { $first: '$entry_date' }, resolved_at: { $max: '$statusHistory.changed_at' } } },
                { $project: { diffDays: { $divide: [{ $subtract: ['$resolved_at', '$entry_date'] }, 86_400_000] } } },
                { $group: { _id: null, avgDays: { $avg: '$diffDays' }, minDays: { $min: '$diffDays' }, maxDays: { $max: '$diffDays' } } },
                { $project: { _id: 0, avgDays: { $round: ['$avgDays', 1] }, minDays: { $round: ['$minDays', 1] }, maxDays: { $round: ['$maxDays', 1] } } },
            ]),

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                {
                    $facet: {
                        today_received: [{ $match: { entry_date: { $gte: todayStart, $lte: todayEnd } } }, { $group: { _id: '$type.id', n: { $sum: 1 } } }],
                        today_finished: [{ $match: { 'currentStatus.id': { $in: [7, 8] }, statusHistory: { $elemMatch: { 'toStatus.id': 7, changed_at: { $gte: todayStart, $lte: todayEnd } } } } }, { $group: { _id: '$type.id', n: { $sum: 1 } } }],
                        today_delivered: [{ $match: { statusHistory: { $elemMatch: { 'toStatus.id': 8, changed_at: { $gte: todayStart, $lte: todayEnd } } } } }, { $group: { _id: '$type.id', n: { $sum: 1 } } }],
                        today_collected: [{ $match: { payments: { $elemMatch: { flow_type: 'INGRESO', paid_at: { $gte: todayStart, $lte: todayEnd } } } } }, { $count: 'n' }],

                        week_received: [{ $match: { entry_date: { $gte: weekStart, $lte: todayEnd } } }, { $group: { _id: '$type.id', n: { $sum: 1 } } }],
                        week_finished: [{ $match: { 'currentStatus.id': { $in: [7, 8] }, statusHistory: { $elemMatch: { 'toStatus.id': 7, changed_at: { $gte: weekStart, $lte: todayEnd } } } } }, { $group: { _id: '$type.id', n: { $sum: 1 } } }],
                        week_delivered: [{ $match: { statusHistory: { $elemMatch: { 'toStatus.id': 8, changed_at: { $gte: weekStart, $lte: todayEnd } } } } }, { $group: { _id: '$type.id', n: { $sum: 1 } } }],
                        week_collected: [{ $match: { payments: { $elemMatch: { flow_type: 'INGRESO', paid_at: { $gte: weekStart, $lte: todayEnd } } } } }, { $count: 'n' }],

                        month_received: [{ $match: { entry_date: { $gte: monthStart, $lte: now } } }, { $group: { _id: '$type.id', n: { $sum: 1 } } }],
                        month_finished: [{ $match: { 'currentStatus.id': { $in: [7, 8] }, statusHistory: { $elemMatch: { 'toStatus.id': 7, changed_at: { $gte: monthStart, $lte: now } } } } }, { $group: { _id: '$type.id', n: { $sum: 1 } } }],
                        month_delivered: [{ $match: { statusHistory: { $elemMatch: { 'toStatus.id': 8, changed_at: { $gte: monthStart, $lte: now } } } } }, { $group: { _id: '$type.id', n: { $sum: 1 } } }],
                        month_collected: [{ $match: { payments: { $elemMatch: { flow_type: 'INGRESO', paid_at: { $gte: monthStart, $lte: now } } } } }, { $count: 'n' }],
                    },
                },
            ]),

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, 'currentStatus.id': 8 } },
                { $lookup: { from: 'order_validations', localField: 'id', foreignField: 'order_id', as: 'validation' } },
                { $unwind: { path: '$validation', preserveNullAndEmptyArrays: true } },
                { $group: { _id: null, checked: { $sum: { $cond: [{ $eq: ['$validation.is_checked', true] }, 1, 0] } }, unchecked: { $sum: { $cond: [{ $or: [{ $eq: ['$validation', null] }, { $eq: ['$validation.is_checked', false] }] }, 1, 0] } } } },
                { $project: { _id: 0, checked: 1, unchecked: 1 } },
            ]),

            // ── NUEVO: estado actual por tipo (histórico completo, sin filtro de fecha) ──
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                { $group: { _id: { typeId: '$type.id', statusId: '$currentStatus.id' }, count: { $sum: 1 } } },
                { $project: { _id: 0, typeId: '$_id.typeId', statusId: '$_id.statusId', count: 1 } },
            ]),

            // ── NUEVO: costo de procedimientos por tipo (histórico completo) ──
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                { $unwind: { path: '$findings', preserveNullAndEmptyArrays: true } },
                { $unwind: { path: '$findings.procedures', preserveNullAndEmptyArrays: true } },
                { $group: { _id: '$type.id', totalProceduresCost: { $sum: { $cond: [{ $eq: ['$findings.procedures.is_active', true] }, { $ifNull: ['$findings.procedures.procedure_cost', 0] }, 0] } } } },
            ]),

            // ── NUEVO: dinero cobrado por tipo, faceteado hoy/semana/mes/histórico ──
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                { $unwind: '$payments' },
                { $match: { 'payments.flow_type': 'INGRESO' } },
                {
                    $facet: {
                        today: [{ $match: { 'payments.paid_at': { $gte: todayStart, $lte: todayEnd } } }, { $group: { _id: '$type.id', collected: { $sum: '$payments.amount' }, paymentsCount: { $sum: 1 } } }],
                        week: [{ $match: { 'payments.paid_at': { $gte: weekStart, $lte: todayEnd } } }, { $group: { _id: '$type.id', collected: { $sum: '$payments.amount' }, paymentsCount: { $sum: 1 } } }],
                        month: [{ $match: { 'payments.paid_at': { $gte: monthStart, $lte: now } } }, { $group: { _id: '$type.id', collected: { $sum: '$payments.amount' }, paymentsCount: { $sum: 1 } } }],
                        all: [{ $group: { _id: '$type.id', collected: { $sum: '$payments.amount' }, paymentsCount: { $sum: 1 } } }],
                    },
                },
            ]),
        ]);

        // ── Helpers de drillCounts (igual que antes) ────────────────────────────────
        const c = (key: string): number => drillCounts[0]?.[key]?.[0]?.n ?? 0;

        const cByType = (key: string) => {
            const rows: { _id: number | null; n: number }[] = drillCounts[0]?.[key] ?? [];
            const byType: Record<string, number> = { '1': 0, '2': 0, '3': 0 };
            let total = 0;
            for (const r of rows) {
                if (r._id != null && byType[String(r._id)] !== undefined) byType[String(r._id)] = r.n;
                total += r.n;
            }
            return { total, byType };
        };

        const statusMap: Record<number, number> = Object.fromEntries(byStatus.map((s: any) => [s.id, s.count]));

        const counts = {
            today: { received: cByType('today_received'), finished: cByType('today_finished'), delivered: cByType('today_delivered'), collected: c('today_collected') },
            week: { received: cByType('week_received'), finished: cByType('week_finished'), delivered: cByType('week_delivered'), collected: c('week_collected') },
            month: { received: cByType('month_received'), finished: cByType('month_finished'), delivered: cByType('month_delivered'), collected: c('month_collected') },
            global: {
                all: byStatus.reduce((s: number, r: any) => s + r.count, 0),
                pending: statusMap[1] ?? 0,
                in_progress: statusMap[6] ?? 0,
                waiting_approval: statusMap[4] ?? 0,
                waiting_parts: statusMap[5] ?? 0,
                finished: statusMap[7] ?? 0,
                delivered: statusMap[8] ?? 0,
            },
            validations: { checked: validationCounts[0]?.checked ?? 0, unchecked: validationCounts[0]?.unchecked ?? 0 },
        };

        // ── Cálculos derivados (igual que antes) ────────────────────────────────
        const totalPaid = byBranch.reduce((s: number, b: any) => s + b.revenue, 0);
        const totalCost = financeData[0]?.totalProceduresCost ?? 0;
        const avgTicket = counts.global.delivered > 0 ? +(totalPaid / counts.global.delivered).toFixed(2) : 0;

        // ── weeklyTrend: reshape con byType para stacked bar ────────────────────
        const TYPE_IDS = ['1', '2', '3'] as const;
        const emptyTypeCounters = () => ({ '1': { ingresadas: 0, entregadas: 0, revenue: 0 }, '2': { ingresadas: 0, entregadas: 0, revenue: 0 }, '3': { ingresadas: 0, entregadas: 0, revenue: 0 } });

        const weeklyTrendMap = new Map<string, any>();
        for (const row of weeklyTrendRaw) {
            if (!weeklyTrendMap.has(row.date)) {
                weeklyTrendMap.set(row.date, { date: row.date, ingresadas: 0, entregadas: 0, revenue: 0, byType: emptyTypeCounters() });
            }
            const entry = weeklyTrendMap.get(row.date);
            entry.ingresadas += row.ingresadas;
            entry.entregadas += row.entregadas;
            entry.revenue += row.revenue;
            const tId = String(row.typeId);
            if (entry.byType[tId]) entry.byType[tId] = { ingresadas: row.ingresadas, entregadas: row.entregadas, revenue: row.revenue };
        }
        const weeklyTrend = Array.from(weeklyTrendMap.values()).sort((a, b) => a.date.localeCompare(b.date));

        // ── hourlyToday: reshape con byType para stacked bar ────────────────────
        const hourlyToday = Array.from({ length: 24 }, (_, h) => {
            const rowsForHour = hourlyTodayRaw.filter((r: any) => r.hour === h);
            const byType = emptyTypeCounters() as any;
            let count = 0, revenue = 0;
            for (const r of rowsForHour) {
                count += r.count; revenue += r.revenue;
                const tId = String(r.typeId);
                if (byType[tId]) byType[tId] = { count: r.count, revenue: r.revenue };
            }
            return { hour: h, count, revenue, byType };
        });

        // ── NUEVO: secciones completas por tipo de orden ─────────────────────────
        const TYPE_NAMES: Record<string, string> = { '1': 'Servicio Técnico', '2': 'Personalizado', '3': 'Para Repuestos' };

        const typeStatusMap: Record<string, Record<number, number>> = { '1': {}, '2': {}, '3': {} };
        for (const row of byTypeStatus) {
            const tId = String(row.typeId);
            if (typeStatusMap[tId]) typeStatusMap[tId][row.statusId] = row.count;
        }

        const typeFinanceCostMap: Record<string, number> = { '1': 0, '2': 0, '3': 0 };
        for (const row of byTypeFinance) {
            const tId = String(row._id);
            if (typeFinanceCostMap[tId] !== undefined) typeFinanceCostMap[tId] = row.totalProceduresCost ?? 0;
        }

        const moneyByType = (bucket: 'today' | 'week' | 'month' | 'all') => {
            const rows: { _id: number; collected: number; paymentsCount: number }[] = byTypeMoney[0]?.[bucket] ?? [];
            const map: Record<string, { collected: number; paymentsCount: number }> = {
                '1': { collected: 0, paymentsCount: 0 }, '2': { collected: 0, paymentsCount: 0 }, '3': { collected: 0, paymentsCount: 0 },
            };
            for (const r of rows) {
                const tId = String(r._id);
                if (map[tId]) map[tId] = { collected: r.collected ?? 0, paymentsCount: r.paymentsCount ?? 0 };
            }
            return map;
        };

        const moneyToday = moneyByType('today');
        const moneyWeek = moneyByType('week');
        const moneyMonth = moneyByType('month');
        const moneyAll = moneyByType('all');

        const receivedByType = { today: cByType('today_received'), week: cByType('week_received'), month: cByType('month_received') };
        const finishedByType = { today: cByType('today_finished'), week: cByType('week_finished'), month: cByType('month_finished') };
        const deliveredByType = { today: cByType('today_delivered'), week: cByType('week_delivered'), month: cByType('month_delivered') };

        const sections: Record<string, any> = {};
        for (const tId of TYPE_IDS) {
            const sMap = typeStatusMap[tId] ?? {};
            const all = Object.values(sMap).reduce((s, n) => s + n, 0);
            const delivered = sMap[8] ?? 0;
            const typeTotalPaid = moneyAll[tId].collected;
            const typeTotalCost = typeFinanceCostMap[tId] ?? 0;

            sections[tId] = {
                typeName: TYPE_NAMES[tId],
                counts: {
                    today: { received: receivedByType.today.byType[tId] ?? 0, finished: finishedByType.today.byType[tId] ?? 0, delivered: deliveredByType.today.byType[tId] ?? 0, collected: moneyToday[tId].collected, paymentsCount: moneyToday[tId].paymentsCount },
                    week: { received: receivedByType.week.byType[tId] ?? 0, finished: finishedByType.week.byType[tId] ?? 0, delivered: deliveredByType.week.byType[tId] ?? 0, collected: moneyWeek[tId].collected, paymentsCount: moneyWeek[tId].paymentsCount },
                    month: { received: receivedByType.month.byType[tId] ?? 0, finished: finishedByType.month.byType[tId] ?? 0, delivered: deliveredByType.month.byType[tId] ?? 0, collected: moneyMonth[tId].collected, paymentsCount: moneyMonth[tId].paymentsCount },
                },
                global: {
                    all,
                    pending: sMap[1] ?? 0,
                    in_progress: sMap[6] ?? 0,
                    waiting_approval: sMap[4] ?? 0,
                    waiting_parts: sMap[5] ?? 0,
                    finished: sMap[7] ?? 0,
                    delivered,
                },
                finance: {
                    totalProceduresCost: typeTotalCost,
                    totalPaid: typeTotalPaid,
                    totalPending: typeTotalCost - typeTotalPaid,
                    avgTicket: delivered > 0 ? +(typeTotalPaid / delivered).toFixed(2) : 0,
                },
            };
        }

        return {
            periods: { today: statsDay, week: statsWeek, month: statsMonth },
            counts,
            totals: { all: counts.global.all, active: counts.global.all - counts.global.delivered, delivered: counts.global.delivered, finished: counts.global.finished },
            byStatus, finance: { totalProceduresCost: totalCost, totalPaid, totalPending: totalCost - totalPaid, avgTicket },
            byBranch, byTechnician, byOrderType, byDeviceBrand, paymentMethods,
            weeklyTrend, hourlyToday,
            resolutionTime: resolutionTime[0] ?? { avgDays: 0, minDays: 0, maxDays: 0 },
            validations: { checked: validationCounts[0]?.checked ?? 0, unchecked: validationCounts[0]?.unchecked ?? 0 },
            sections, // ← NUEVO: { '1': {...ST}, '2': {...Personalizado}, '3': {...Repuestos} }
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DASHBOARD ADMIN — RANGO CUSTOM
    // ─────────────────────────────────────────────────────────────────────────

    async getAdminDashboardRange(companyId: string, from: string, to: string): Promise<any> {
        const rangeStart = _gyeDayStart(from);
        const rangeEnd = _gyeDayEnd(to);

        const [
            byStatus, financeData, byBranch, byTechnician, weeklyTrend,
            periodStats, hourlyRange, byDeviceBrand, byOrderType, paymentMethods,
            resolutionTime, rangeCounts, validationCounts,
        ] = await Promise.all([

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, entry_date: { $gte: rangeStart, $lt: rangeEnd } } },
                { $group: { _id: { id: '$currentStatus.id', name: '$currentStatus.name' }, count: { $sum: 1 } } },
                { $project: { _id: 0, id: '$_id.id', name: '$_id.name', count: 1 } },
                { $sort: { id: 1 } },
            ]),

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, entry_date: { $gte: rangeStart, $lt: rangeEnd } } },
                { $unwind: { path: '$findings', preserveNullAndEmptyArrays: true } },
                { $unwind: { path: '$findings.procedures', preserveNullAndEmptyArrays: true } },
                { $group: { _id: null, totalProceduresCost: { $sum: { $cond: [{ $eq: ['$findings.procedures.is_active', true] }, { $ifNull: ['$findings.procedures.procedure_cost', 0] }, 0] } } } },
            ]),

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, entry_date: { $gte: rangeStart, $lt: rangeEnd } } },
                { $group: { _id: { id: '$branch.id', name: '$branch.name' }, total: { $sum: 1 }, delivered: { $sum: { $cond: [{ $eq: ['$currentStatus.id', 8] }, 1, 0] } }, revenue: { $sum: { $reduce: { input: '$payments', initialValue: 0, in: { $add: ['$$value', { $cond: [{ $eq: ['$$this.flow_type', 'INGRESO'] }, '$$this.amount', 0] }] } } } } } },
                { $project: { _id: 0, branchId: '$_id.id', branchName: '$_id.name', total: 1, delivered: 1, revenue: 1 } },
                { $sort: { total: -1 } },
            ]),

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, entry_date: { $gte: rangeStart, $lt: rangeEnd }, 'technicians.0': { $exists: true } } },
                { $unwind: '$technicians' },
                { $group: { _id: '$technicians.id', name: { $first: { $concat: ['$technicians.first_name', ' ', '$technicians.last_name'] } }, total: { $sum: 1 }, resolved: { $sum: { $cond: [{ $in: ['$currentStatus.id', [7, 8]] }, 1, 0] } } } },
                { $project: { _id: 0, techId: '$_id', name: 1, total: 1, resolved: 1 } },
                { $sort: { total: -1 } }, { $limit: 10 },
            ]),

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, entry_date: { $gte: rangeStart, $lt: rangeEnd } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$entry_date', timezone: 'America/Guayaquil' } }, ingresadas: { $sum: 1 }, entregadas: { $sum: { $cond: [{ $eq: ['$currentStatus.id', 8] }, 1, 0] } }, revenue: { $sum: { $reduce: { input: '$payments', initialValue: 0, in: { $add: ['$$value', { $cond: [{ $eq: ['$$this.flow_type', 'INGRESO'] }, '$$this.amount', 0] }] } } } } } },
                { $project: { _id: 0, date: '$_id', ingresadas: 1, entregadas: 1, revenue: 1 } },
                { $sort: { date: 1 } },
            ]),

            this._periodStats(companyId, rangeStart, rangeEnd),

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, entry_date: { $gte: rangeStart, $lt: rangeEnd } } },
                { $group: { _id: { $hour: { date: '$entry_date', timezone: 'America/Guayaquil' } }, count: { $sum: 1 }, revenue: { $sum: { $reduce: { input: '$payments', initialValue: 0, in: { $add: ['$$value', { $cond: [{ $eq: ['$$this.flow_type', 'INGRESO'] }, '$$this.amount', 0] }] } } } } } },
                { $project: { _id: 0, hour: '$_id', count: 1, revenue: 1 } },
                { $sort: { hour: 1 } },
            ]),

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, entry_date: { $gte: rangeStart, $lt: rangeEnd }, 'device.model.brand_name': { $exists: true, $ne: null } } },
                { $group: { _id: { id: '$device.model.brand_id', name: '$device.model.brand_name' }, total: { $sum: 1 } } },
                { $project: { _id: 0, brandId: '$_id.id', brandName: '$_id.name', total: 1 } },
                { $sort: { total: -1 } }, { $limit: 8 },
            ]),

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, entry_date: { $gte: rangeStart, $lt: rangeEnd } } },
                { $group: { _id: { id: '$type.id', name: '$type.name' }, count: { $sum: 1 } } },
                { $project: { _id: 0, typeId: '$_id.id', typeName: '$_id.name', count: 1 } },
                { $sort: { count: -1 } },
            ]),

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                { $unwind: '$payments' },
                { $match: { 'payments.flow_type': 'INGRESO', 'payments.paid_at': { $gte: rangeStart, $lt: rangeEnd } } },
                { $group: { _id: { id: '$payments.payment_method_id', name: '$payments.payment_method_name' }, total: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
                { $project: { _id: 0, methodId: '$_id.id', methodName: '$_id.name', total: 1, count: 1 } },
                { $sort: { total: -1 } },
            ]),

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, entry_date: { $gte: rangeStart, $lt: rangeEnd }, 'currentStatus.id': { $in: [7, 8] } } },
                { $unwind: '$statusHistory' },
                { $match: { 'statusHistory.toStatus.id': { $in: [7, 8] } } },
                { $group: { _id: '$_id', entry_date: { $first: '$entry_date' }, resolved_at: { $max: '$statusHistory.changed_at' } } },
                { $project: { diffDays: { $divide: [{ $subtract: ['$resolved_at', '$entry_date'] }, 86_400_000] } } },
                { $group: { _id: null, avgDays: { $avg: '$diffDays' }, minDays: { $min: '$diffDays' }, maxDays: { $max: '$diffDays' } } },
                { $project: { _id: 0, avgDays: { $round: ['$avgDays', 1] }, minDays: { $round: ['$minDays', 1] }, maxDays: { $round: ['$maxDays', 1] } } },
            ]),

            // ── rangeCounts: received/finished/delivered ahora desglosados por type.id ──
            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId } },
                {
                    $facet: {
                        range_received: [
                            { $match: { entry_date: { $gte: rangeStart, $lt: rangeEnd } } },
                            { $group: { _id: '$type.id', n: { $sum: 1 } } },
                        ],
                        range_finished: [
                            { $match: { 'currentStatus.id': { $in: [7, 8] }, statusHistory: { $elemMatch: { 'toStatus.id': 7, changed_at: { $gte: rangeStart, $lt: rangeEnd } } } } },
                            { $group: { _id: '$type.id', n: { $sum: 1 } } },
                        ],
                        range_delivered: [
                            { $match: { statusHistory: { $elemMatch: { 'toStatus.id': 8, changed_at: { $gte: rangeStart, $lt: rangeEnd } } } } },
                            { $group: { _id: '$type.id', n: { $sum: 1 } } },
                        ],
                        range_payments_count: [{ $match: { payments: { $elemMatch: { flow_type: 'INGRESO', paid_at: { $gte: rangeStart, $lt: rangeEnd } } } } }, { $count: 'n' }],
                    },
                },
            ]),

            this.orderReplicaModel.aggregate([
                { $match: { 'company.id': companyId, 'currentStatus.id': 8 } },
                { $lookup: { from: 'order_validations', localField: 'id', foreignField: 'order_id', as: 'validation' } },
                { $unwind: { path: '$validation', preserveNullAndEmptyArrays: true } },
                { $group: { _id: null, checked: { $sum: { $cond: [{ $eq: ['$validation.is_checked', true] }, 1, 0] } }, unchecked: { $sum: { $cond: [{ $or: [{ $eq: ['$validation', null] }, { $eq: ['$validation.is_checked', false] }] }, 1, 0] } } } },
                { $project: { _id: 0, checked: 1, unchecked: 1 } },
            ]),
        ]);

        // ── Helpers ────────────────────────────────────────────────────────────────
        const c = (key: string): number => rangeCounts[0]?.[key]?.[0]?.n ?? 0;

        const cByType = (key: string) => {
            const rows: { _id: number | null; n: number }[] = rangeCounts[0]?.[key] ?? [];
            const byType: Record<string, number> = { '1': 0, '2': 0, '3': 0 };
            let total = 0;
            for (const r of rows) {
                if (r._id != null && byType[String(r._id)] !== undefined) {
                    byType[String(r._id)] = r.n;
                }
                total += r.n;
            }
            return { total, byType };
        };

        const statusMap: Record<number, number> = Object.fromEntries(byStatus.map((s: any) => [s.id, s.count]));

        const rangeDeliveredCount = cByType('range_delivered');
        const totalPaid = byBranch.reduce((s: number, b: any) => s + b.revenue, 0);
        const totalCost = financeData[0]?.totalProceduresCost ?? 0;
        const avgTicket = rangeDeliveredCount.total > 0 ? +(totalPaid / rangeDeliveredCount.total).toFixed(2) : 0;

        const counts = {
            range: {
                received: cByType('range_received'),
                finished: cByType('range_finished'),
                delivered: rangeDeliveredCount,
                collected: c('range_payments_count'),
            },
            global: {
                all: byStatus.reduce((s: number, r: any) => s + r.count, 0),
                pending: statusMap[1] ?? 0, in_progress: statusMap[6] ?? 0,
                waiting_approval: statusMap[4] ?? 0, waiting_parts: statusMap[5] ?? 0,
                finished: statusMap[7] ?? 0, delivered: statusMap[8] ?? 0,
            },
        };

        return {
            periods: { range: periodStats },
            counts, byStatus,
            finance: { totalProceduresCost: totalCost, totalPaid, totalPending: totalCost - totalPaid, avgTicket },
            byBranch, byTechnician, byOrderType, byDeviceBrand, paymentMethods,
            weeklyTrend, hourlyToday: hourlyRange,
            resolutionTime: resolutionTime[0] ?? { avgDays: 0, minDays: 0, maxDays: 0 },
            meta: { from, to, rangeStart: rangeStart.toISOString(), rangeEnd: rangeEnd.toISOString() },
            validations: { checked: validationCounts[0]?.checked ?? 0, unchecked: validationCounts[0]?.unchecked ?? 0 },
        };
    }


}