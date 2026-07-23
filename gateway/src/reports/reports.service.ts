import { Body, Inject, Injectable, Param, Patch } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { GetOrdersFilterDto } from './dto/get-orders-filter.dto.gateway';
import { GetAdminDashboardRangeDto } from './dto/get-admin-dashboard.dto.gateway';
import { RegisterOrderPrintDto } from './dto/register-order-print.dto.gateway';
import { RegisterPrintCopyDto } from './dto/register-print-copy.dto.gateway';
import { GetEmployeesFinesDto } from './dto/get-employees-fines.dto';
import { UpdateFineStatusDto } from './dto/update-fine-status.dto';
import { GetFinesListDto } from './dto/get-fines-list.dto';

@Injectable()
export class ReportsService {
    constructor(
        @Inject('REPORT_SERVICE') private readonly client: ClientProxy,
    ) { }

    async getOrderFilters(user: any) {
        // La lógica de "mensajería" se queda aquí
        return await firstValueFrom(
            this.client.send(
                { cmd: 'get_order_filters_metadata' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    user,
                },
            ),
        );
    }
    async getOrdersList(user: any, filterDto: GetOrdersFilterDto) {

        return await firstValueFrom(
            this.client.send(
                { cmd: 'get_order_list_metadata' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    data: filterDto,
                    user,
                },
            ),
        );
    }
    async getDashboardCustomer(user: any) {
        return await firstValueFrom(
            this.client.send(
                { cmd: 'fetch_customer_for_dashboard_orders' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    user,
                },
            ),
        );
    }
    async getOrderDetail(user: any, orderId: number) {
        return await firstValueFrom(
            this.client.send(
                { cmd: 'get_order_detail' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    user,
                    orderId,
                },
            ),
        );
    }
    async getDashboard(user: any): Promise<any> {
        return firstValueFrom(
            this.client.send(
                { cmd: 'get_dashboard' },
                { internalToken: process.env.INTERNAL_SECRET, user },
            ),
        );
    }
    async getDashboardDrill(user: any, card: string, page: number, limit: number) {
        return await firstValueFrom(
            this.client.send(
                { cmd: 'get_dashboard_drill' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    user,
                    card,
                    page,
                    limit,
                },
            ),
        );
    }


    async toggleOrderValidation(validationId: string, isChecked: boolean, user: any) {
        return await firstValueFrom(
            this.client.send(
                { cmd: 'toggle_order_validation' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    validationId,
                    isChecked,
                    user,
                },
            ),
        );
    }

    async getValidationStatus(OrderId: string,) {
        return await firstValueFrom(
            this.client.send(
                { "cmd": "get_order_validation_status" },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    OrderId,
                },
            ),
        );
    }

    async getAdminDashboardRange(user: any, dto: GetAdminDashboardRangeDto) {
        return await firstValueFrom(
            this.client.send(
                { cmd: 'get_admin_dashboard_range' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    user: {
                        userId: user.sub,
                        companyId: user.companyId,
                    },
                    from: dto.from,
                    to: dto.to,
                },
            ),
        );
    }

    // gateway/reports/reports.service.ts (método agregado)
    async registerOrderPrint(user: any, dto: RegisterOrderPrintDto) {
        return await firstValueFrom(
            this.client.send(
                { cmd: 'register_order_print' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    data: dto,
                    user: {
                        userId: user.sub,
                        companyId: user.companyId,
                    },
                },
            ),
        );
    }
    async getPrintStatus(dto: any) {
        return await firstValueFrom(
            this.client.send(
                { cmd: 'get_print_status' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    data: dto,
                },
            ),
        );
    }
    async registerPrintCopy(user: any, dto: RegisterPrintCopyDto) {
        return await firstValueFrom(
            this.client.send(
                { cmd: 'register_print_copy' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    data: dto,
                    user: {
                        userId: user.sub,
                        companyId: user.companyId,
                        branchId: user.branchId,
                    },
                },
            ),
        );
    }
    async getEmployeesFinesSummary(user: any, dto: GetEmployeesFinesDto) {
        return await firstValueFrom(
            this.client.send(
                { cmd: 'get_employees_fines_summary' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    data: dto,
                    user: {
                        userId: user.sub,
                        companyId: user.companyId,
                        branchId: user.branchId,
                    },
                },
            ),
        );
    }

    async updateFineStatus(user: any, dto: UpdateFineStatusDto) {
        return await firstValueFrom(
            this.client.send(
                { cmd: 'update_fine_status' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    data: dto,
                    user: {
                        userId: user.sub,
                        companyId: user.companyId,
                        branchId: user.branchId,
                    },
                },
            ),
        );
    }

    // gateway/fines.gateway.service.ts (agregar)
    async getFinesList(user: any, dto: GetFinesListDto) {
        return await firstValueFrom(
            this.client.send(
                { cmd: 'get_fines_list' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    data: dto,
                    user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
                },
            ),
        );
    }

    async getEmployeesForFilter(user: any) {
        return await firstValueFrom(
            this.client.send(
                { cmd: 'get_employees_for_filter' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    data: {},
                    user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
                },
            ),
        );
    }
    async getFineDetail(user: any, fineId: string) {
        return await firstValueFrom(
            this.client.send(
                { cmd: 'get_fine_detail' },
                {
                    internalToken: process.env.INTERNAL_SECRET,
                    data: { fineId },
                    user: { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
                },
            ),
        );
    }
}