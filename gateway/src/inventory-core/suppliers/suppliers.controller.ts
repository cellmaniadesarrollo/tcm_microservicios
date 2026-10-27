import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { Auth } from '../../common/auth/decorators/auth.decorator';
import { User } from '../../common/auth/decorators/user.decorator';
import { CreateSupplierGatewayDto } from './dto/create-supplier-gateway.dto';
import { ListSuppliersQueryDto } from './dto/list-suppliers-query.dto';
import { UpdateSupplierGatewayDto } from './dto/update-supplier-gateway.dto';
import { UpdateSupplierStatusGatewayDto } from './dto/update-supplier-status-gateway.dto';


@Controller('suppliers')
@Auth()
export class SuppliersController {
    constructor(private readonly suppliersService: SuppliersService) { }

    private ctx(user: any) {
        return { userId: user.sub, companyId: user.companyId, branchId: user.branchId };
    }

    @Get('new-data')
    async getNewData(@User() user: any) {
        return this.suppliersService.getFormOptions(this.ctx(user));
    }
    @Post()
    async createSupplier(@Body() dto: CreateSupplierGatewayDto, @User() user: any) {
        return this.suppliersService.createSupplier(dto, this.ctx(user));
    }
    @Get()
    async list(@Query() query: ListSuppliersQueryDto, @User() user: any) {
        return this.suppliersService.list(query, this.ctx(user));
    }

    @Get(':id')
    async getFullData(@Param('id', ParseUUIDPipe) id: string, @User() user: any) {
        return this.suppliersService.getFullData(id, this.ctx(user));
    }


    @Patch(':id')
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateSupplierGatewayDto,
        @User() user: any,
    ) {
        return this.suppliersService.updateSupplier(id, dto, this.ctx(user));
    }

    @Patch(':id/status')
    async updateStatus(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateSupplierStatusGatewayDto,
        @User() user: any,
    ) {
        return this.suppliersService.updateSupplierStatus(id, dto.status, this.ctx(user));
    }
}