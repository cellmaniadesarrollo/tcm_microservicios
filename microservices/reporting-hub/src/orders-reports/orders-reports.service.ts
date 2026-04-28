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
}