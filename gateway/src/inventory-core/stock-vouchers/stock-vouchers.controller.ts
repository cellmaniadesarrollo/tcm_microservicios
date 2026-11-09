import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { Auth } from '../../common/auth/decorators/auth.decorator';
import { User } from '../../common/auth/decorators/user.decorator';
import { CreateStockVoucherGatewayDto } from './dto/create-stock-voucher-gateway.dto';
import { ListStockVouchersQueryDto } from './dto/list-stock-vouchers-query.dto';
import { StockVouchersService } from './stock-vouchers.service';
import { parseMultipartRequest } from '../../common/helpers/multipart-request.helper';
import { FastifyRequest } from 'fastify';
import { parseJsonField } from '../../common/helpers/parse-json-field.helper';
import { prepareStockVoucherFiles } from './helpers/stock-voucher-attachments.helper';


@Controller('stock-vouchers')
@Auth()
export class StockVouchersController {
    constructor(private readonly stockVouchersService: StockVouchersService) { }

    private ctx(user: any) {
        return { userId: user.sub, companyId: user.companyId, branchId: user.branchId };
    }

    // ── Rutas literales primero (antes de ':id') ──

    /** Formulario: motivos con sus reglas (dirección, si exige orden, si admite retorno). */
    @Get('new-data')
    async getNewData(@User() user: any) {
        return this.stockVouchersService.getNewData(this.ctx(user));
    }

    /** Lotes con existencias de un producto (sucursal principal), más antiguos primero. */
    @Get('products/:productId/lots')
    async searchLots(@Param('productId', ParseUUIDPipe) productId: string, @User() user: any) {
        return this.stockVouchersService.searchLots(productId, this.ctx(user));
    }

    /** Unidades disponibles (IMEI/serial) de un lote, para elegir cuáles salen. */
    @Get('lots/:lotId/units')
    async listLotUnits(@Param('lotId', ParseUUIDPipe) lotId: string, @User() user: any) {
        return this.stockVouchersService.listLotUnits(lotId, this.ctx(user));
    }

    /** Movimientos de una orden y su costo neto (salidas − retornos). */
    @Get('orders/:orderId')
    async getOrderSummary(@Param('orderId', ParseIntPipe) orderId: number, @User() user: any) {
        return this.stockVouchersService.getOrderSummary(orderId, this.ctx(user));
    }

    // ── Vales ──

    @Post()
    async create(@Req() request: FastifyRequest, @User() user: any) {
        const { files, formData } = await parseMultipartRequest(request);
        const dto = await parseJsonField(CreateStockVoucherGatewayDto, formData.data);
        const attachments = await prepareStockVoucherFiles(files, dto.lines?.length ?? 0);
        return this.stockVouchersService.create(dto, attachments, this.ctx(user));
    }

    @Get()
    async list(@Query() query: ListStockVouchersQueryDto, @User() user: any) {
        return this.stockVouchersService.list(query, this.ctx(user));
    }

    @Get(':id')
    async getDetail(@Param('id', ParseUUIDPipe) id: string, @User() user: any) {
        return this.stockVouchersService.getDetail(id, this.ctx(user));
    }
}