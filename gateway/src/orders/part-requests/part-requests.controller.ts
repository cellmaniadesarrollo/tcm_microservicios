// gateway/src/orders/part-requests.controller.ts

import { Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

import { Auth } from '../../common/auth/decorators/auth.decorator';
import { Features } from '../../common/auth/decorators/features.decorator';
import { User } from '../../common/auth/decorators/user.decorator';

import {
    parseMultipartRequest,
    processAndValidateFiles,
    serializeFilesForMicroservice,
} from '../../common/helpers/multipart-request.helper';

import { CreatePartRequestGatewayDto } from './dto/create-part-request-gateway.dto';
import { PartRequestsGatewayService } from './part-requests-gateway.service';
import { ListPartRequestsGatewayDto } from './dto/list-part-requests-gateway.dto';

@Controller('part-requests')
@Auth()
@Features('orders')
export class PartRequestsController {
    constructor(private readonly partRequestsGatewayService: PartRequestsGatewayService) { }

    @Post()
    async createPartRequest(@Req() request: FastifyRequest, @User() user: any) {
        const { files, formData } = await parseMultipartRequest(request);
        const processedFiles = await processAndValidateFiles(files);

        let posiblesLugares: string[] | undefined;
        if (formData.posiblesLugares) {
            // el front puede mandarlo como JSON string en multipart, o como campos repetidos
            posiblesLugares = Array.isArray(formData.posiblesLugares)
                ? formData.posiblesLugares
                : JSON.parse(formData.posiblesLugares);
        }

        const dto: CreatePartRequestGatewayDto = {
            orderId: Number(formData.orderId),
            descripcion: formData.descripcion,
            posiblesLugares,
        };

        return this.partRequestsGatewayService.createPartRequest(
            dto,
            serializeFilesForMicroservice(processedFiles),
            { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        );
    }
    @Get('order/:orderId')
    async listByOrder(
        @Param('orderId', ParseIntPipe) orderId: number,
        @User() user: any,
    ) {
        return this.partRequestsGatewayService.listByOrder(orderId, {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
        });
    }
    @Get()
    async listPartRequests(
        @Query('page') page: string,
        @Query('limit') limit: string,
        @Query('search') search: string,
        @Query('estado') estado: string,
        @User() user: any,
    ) {
        const dto: ListPartRequestsGatewayDto = {
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            search: search || undefined,
            estado: estado || undefined,
        };

        return this.partRequestsGatewayService.listPartRequests(dto, {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
        });
    }
    @Get(':id')
    async getPartRequestFullData(
        @Param('id', ParseIntPipe) id: number,
        @User() user: any,
    ) {
        return this.partRequestsGatewayService.getPartRequestFullData(id, {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
        });
    }
    @Patch(':id/tomar')
    async tomarPartRequest(
        @Param('id', ParseIntPipe) id: number,
        @User() user: any,
    ) {
        return this.partRequestsGatewayService.tomarPartRequest(id, {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
        });
    }
    @Get('mis-aceptadas')
    async listMyAcceptedPartRequests(
        @Query('page') page: string,
        @Query('limit') limit: string,
        @Query('search') search: string,
        @Query('estado') estado: string,
        @User() user: any,
    ) {
        const dto: ListPartRequestsGatewayDto = {
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            search: search || undefined,
            estado: estado || undefined,
        };

        return this.partRequestsGatewayService.listMyAcceptedPartRequests(dto, {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
        });
    }
}