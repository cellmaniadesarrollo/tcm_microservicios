// gateway/src/orders/device-purchases/device-purchases.controller.ts
import {
    BadRequestException, Controller, Get, Param, ParseIntPipe, Post, Query, Req,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';


import { DevicePurchasesGatewayService } from './device-purchases-gateway.service';
import { CreateDevicePurchaseGatewayDto } from './dto/create-device-purchase-gateway.dto';
import { ListDevicePurchasesGatewayDto } from './dto/list-device-purchases-gateway.dto';
import { Auth } from '../../common/auth/decorators/auth.decorator';
import { Features } from '../../common/auth/decorators/features.decorator';
import { Groups } from '../../common/auth/decorators/groups.decorator';
import { User } from '../../common/auth/decorators/user.decorator';
import { parseMultipartRequest, processAndValidateFiles, serializeFilesForMicroservice } from '../../common/helpers/multipart-request.helper';
import { ListPurchasableOrdersGatewayDto } from './dto/list-purchasable-orders-gateway.dto';

const MAX_PROOF_FILES = 10;

@Controller('device-purchases')
@Auth()
@Features('orders')
export class DevicePurchasesController {
    constructor(private readonly service: DevicePurchasesGatewayService) { }

    private ctx(user: any) {
        return { userId: user.sub, companyId: user.companyId, branchId: user.branchId };
    }

    // TODO: confirmar grupos autorizados
    @Groups('ORDER_AUDIT', 'COMPRAS_DISPOSITIVOS')
    @Post()
    async create(@Req() request: FastifyRequest, @User() user: any) {
        const { files, formData } = await parseMultipartRequest(request);

        const dto = plainToInstance(CreateDevicePurchaseGatewayDto, formData);
        const errors = await validate(dto, { whitelist: true });
        if (errors.length) {
            throw new BadRequestException(errors.flatMap((e) => Object.values(e.constraints ?? {})));
        }

        if (files.length > MAX_PROOF_FILES) {
            throw new BadRequestException(`Máximo ${MAX_PROOF_FILES} comprobantes`);
        }

        const processed = await processAndValidateFiles(files);

        return this.service.create(dto, serializeFilesForMicroservice(processed), this.ctx(user));
    }

    @Groups('ORDER_AUDIT', 'COMPRAS_DISPOSITIVOS')
    @Get()
    list(@Query() query: ListDevicePurchasesGatewayDto, @User() user: any) {
        return this.service.list(query, this.ctx(user));
    }

    @Groups('ORDER_AUDIT', 'COMPRAS_DISPOSITIVOS')
    @Get(':id')
    getById(@Param('id', ParseIntPipe) id: number, @User() user: any) {
        return this.service.getById(id, this.ctx(user));
    }

    @Get('by-order/:orderId')
    getByOrderId(@Param('orderId', ParseIntPipe) orderId: number, @User() user: any) {
        return this.service.getByOrderId(orderId, this.ctx(user));
    }
    // device-purchases.controller.ts (ANTES de @Get(':id')) 
    @Get('orders')
    listOrders(@Query() query: ListPurchasableOrdersGatewayDto, @User() user: any) {
        return this.service.listOrders(query, this.ctx(user));
    }
}