import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { OrderStatus, OrderStatusDocument } from '../orders-relay/schemas/order-status.schema';
import { OrderType, OrderTypeDocument } from '../orders-relay/schemas/order-type.schema';
import { CompanyReplica, CompanyReplicaDocument } from '../companies/schemas/company-replica.schema';
import { UserEmployeeCache, UserEmployeeCacheDocument } from '../users-employees-events/schemas/user-employee-cache.schema';
import { GetOrdersFilterDto } from './dto/order-filters-metadata.dto';
import { OrderReplica, OrderReplicaDocument } from '../orders-relay/schemas/order-replica.schema';

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
    // ─── LA FUNCIÓN QUE FALTABA ───────────────────────────────
    async getOrdersList(companyId: string, dto: GetOrdersFilterDto) {

        const filter = this.buildMongoFilter(companyId, dto);
        console.log(filter)
        const [data, total] = await Promise.all([
            this.orderReplicaModel
                .find(filter)
                .select({
                    id: 1,
                    order_number: 1,
                    currentStatus: 1,
                    type: 1,
                    branch: 1,
                    customer: 1,
                    device: 1,
                    technicians: 1,
                    createdBy: 1,
                    entry_date: 1,
                    estimated_price: 1,
                })
                .sort({ entry_date: -1 })
                .lean(),

            this.orderReplicaModel.countDocuments(filter),
        ]);

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
}