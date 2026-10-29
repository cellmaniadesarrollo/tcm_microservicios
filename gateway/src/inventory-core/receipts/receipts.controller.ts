// receipts.controller.ts
import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { User } from '../../common/auth/decorators/user.decorator';
import { Auth } from '../../common/auth/decorators/auth.decorator';
import { ReceiptsService } from './receipts.service';
import { SearchReceiptProductsQueryDto } from './dto/search-receipt-products-query.dto';
import { SearchSuppliersQueryDto } from './dto/search-suppliers-query.dto';
import { CreateReceiptGatewayDto } from './dto/create-receipt-gateway.dto';
import { validate, ValidationError } from 'class-validator';
import { parseMultipartRequest } from '../../common/helpers/multipart-request.helper';
import { prepareReceiptFiles } from './helpers/receipt-attachments.helper';
import { plainToInstance } from 'class-transformer';
import { FastifyRequest } from 'fastify';
import { ListReceiptsQueryDto } from './dto/list-receipts-query.dto';
import { CreateReceiptPaymentGatewayDto } from './dto/create-receipt-payment-gateway.dto';
import { preparePaymentProof } from './helpers/receipt-payment-proof.helper';
import { VoidReceiptPaymentGatewayDto } from './dto/void-receipt-payment-gateway.dto';
const flatten = (errors: ValidationError[], path = ''): string[] =>
    errors.flatMap((e) => {
        const p = path ? `${path}.${e.property}` : e.property;
        return [...Object.values(e.constraints ?? {}).map((m) => `${p}: ${m}`), ...flatten(e.children ?? [], p)];
    });

@Controller('receipts')
@Auth()
export class ReceiptsController {
    constructor(private readonly receiptsService: ReceiptsService) { }

    private ctx(user: any) {
        return { userId: user.sub, companyId: user.companyId, branchId: user.branchId };
    }

    @Get('new-data')
    async getNewData(@User() user: any) {
        return this.receiptsService.getNewData(this.ctx(user));
    }
    @Get('products/search')
    async searchProducts(@Query() query: SearchReceiptProductsQueryDto, @User() user: any) {
        return this.receiptsService.searchProducts(query, this.ctx(user));
    }
    @Get('suppliers/search')
    async search(@Query() query: SearchSuppliersQueryDto, @User() user: any) {
        return await this.receiptsService.search(query, this.ctx(user));
    }
    @Post()
    async create(@Req() request: FastifyRequest, @User() user: any) {
        const { files, formData } = await parseMultipartRequest(request);
        const dto = await this.buildReceiptDto(formData.data);
        const attachments = await prepareReceiptFiles(files, dto.lines.length, dto.payments?.length ?? 0);
        return this.receiptsService.create(dto, attachments, this.ctx(user));
    }
    private async buildReceiptDto(raw?: string): Promise<CreateReceiptGatewayDto> {
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw ?? '');
        } catch {
            throw new BadRequestException('El campo "data" debe ser un JSON válido');
        }
        const dto = plainToInstance(CreateReceiptGatewayDto, parsed);
        const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
        if (errors.length) throw new BadRequestException(flatten(errors).slice(0, 10));
        return dto;
    }
    @Get()
    async list(@Query() query: ListReceiptsQueryDto, @User() user: any) {
        return this.receiptsService.list(query, this.ctx(user));
    }



    @Post(':id/payments')
    async addPayment(@Param('id', ParseUUIDPipe) id: string, @Req() request: FastifyRequest, @User() user: any) {
        const { files, formData } = await parseMultipartRequest(request);
        const dto = await this.buildDto(CreateReceiptPaymentGatewayDto, formData.data);
        const proof = await preparePaymentProof(files);
        return this.receiptsService.addPayment(id, dto, proof, this.ctx(user));
    }

    @Patch(':id/payments/:paymentId/void')
    async voidPayment(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('paymentId', ParseUUIDPipe) paymentId: string,
        @Body() dto: VoidReceiptPaymentGatewayDto,
        @User() user: any,
    ) {
        return this.receiptsService.voidPayment(id, paymentId, dto, this.ctx(user));
    }

    /** Parsea y valida el JSON del campo "data" de un multipart. */
    private async buildDto<T extends object>(cls: new () => T, raw?: string): Promise<T> {
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw ?? '');
        } catch {
            throw new BadRequestException('El campo "data" debe ser un JSON válido');
        }
        const dto = plainToInstance(cls, parsed);
        const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
        if (errors.length) throw new BadRequestException(flatten(errors).slice(0, 10));
        return dto;
    }

    @Get(':id')
    async getDetail(@Param('id', ParseUUIDPipe) id: string, @User() user: any) {
        return this.receiptsService.getDetail(id, this.ctx(user));
    }
}