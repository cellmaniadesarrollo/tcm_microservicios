// gateway/src/orders/part-requests.controller.ts

import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

import { Auth } from '../../common/auth/decorators/auth.decorator';
import { Features } from '../../common/auth/decorators/features.decorator';
import { Groups } from '../../common/auth/decorators/groups.decorator';
import { User } from '../../common/auth/decorators/user.decorator';

import {
    parseMultipartRequest,
    processAndValidateFiles,
    serializeFilesForMicroservice,
} from '../../common/helpers/multipart-request.helper';

import { CreatePartRequestGatewayDto } from './dto/create-part-request-gateway.dto';
import { PartRequestsGatewayService } from './part-requests-gateway.service';
import { ListPartRequestsGatewayDto } from './dto/list-part-requests-gateway.dto';
import { EncontradoNacionalGatewayDto } from './dto/encontrado-nacional-gateway.dto';
import { CreatePartRequestPaymentGatewayDto } from './dto/create-part-request-payment-gateway.dto';
import { RegistrarEnvioGatewayDto } from './dto/registrar-envio-gateway.dto';
import { AprobarLlegadaGatewayDto } from './dto/aprobar-llegada.dto';
import { RegistrarLlegadaGatewayDto } from './dto/registrar-llegada.dto';
import { NoAprobarLlegadaGatewayDto } from './dto/no-aprobar-llegada-gateway.dto';

@Controller('part-requests')
@Auth()
@Features('orders')
export class PartRequestsController {
    constructor(private readonly partRequestsGatewayService: PartRequestsGatewayService) { }

    // ─── Cualquier logueado ────────────────────────────────────────
    @Post()
    async createPartRequest(@Req() request: FastifyRequest, @User() user: any) {
        const { files, formData } = await parseMultipartRequest(request);
        const processedFiles = await processAndValidateFiles(files);

        let posiblesLugares: string[] | undefined;
        if (formData.posiblesLugares) {
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

    // ─── Cualquier logueado ────────────────────────────────────────
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

    // ─── LOGISTICA_REPUESTOS ────────────────────────────────────────
    @Groups('LOGISTICA_REPUESTOS')
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

    // ─── Cualquier logueado ────────────────────────────────────────
    @Get(':id')
    async getPartRequestFullData(
        @Param('id', ParseIntPipe) id: number,
        @User() user: any,
    ) {
        return this.partRequestsGatewayService.getPartRequestFullData(id, {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
            userGroups: user.groups ?? [], // 👈 se envía para que ms-orders decida si incluir pagos
        });
    }

    // ─── LOGISTICA_REPUESTOS ────────────────────────────────────────
    @Groups('LOGISTICA_REPUESTOS')
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

    // ─── LOGISTICA_REPUESTOS ────────────────────────────────────────
    @Groups('LOGISTICA_REPUESTOS')
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

    // ─── LOGISTICA_REPUESTOS ────────────────────────────────────────
    @Groups('LOGISTICA_REPUESTOS')
    @Patch(':id/encontrado-nacional')
    async encontradoNacional(
        @Param('id', ParseIntPipe) id: number,
        @Req() request: FastifyRequest,
        @User() user: any,
    ) {
        const { files, formData } = await parseMultipartRequest(request);
        const processedFiles = await processAndValidateFiles(files);

        const dto: EncontradoNacionalGatewayDto = {
            id,
            proveedor: formData.proveedor,
            precio: Number(formData.precio),
            cantidad: formData.cantidad ? Number(formData.cantidad) : undefined,
            contactoProveedor: formData.contactoProveedor || undefined,
            linkCompra: formData.linkCompra || undefined,
            notas: formData.notas || undefined,
        };

        return this.partRequestsGatewayService.encontradoNacional(
            dto,
            serializeFilesForMicroservice(processedFiles),
            { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        );
    }

    // ─── ORDER_AUDIT ────────────────────────────────────────────────
    @Groups('ORDER_AUDIT')
    @Get('para-pago')
    async listParaPago(
        @Query('page') page: string,
        @Query('limit') limit: string,
        @Query('search') search: string,
        @Query('filtro') filtro: string,
        @User() user: any,
    ) {
        const dto = {
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            search: search || undefined,
            filtro: (filtro as 'pendientes' | 'pagados' | 'todos') || undefined,
        };

        return this.partRequestsGatewayService.listParaPago(dto, {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
        });
    }

    // ─── ORDER_AUDIT ────────────────────────────────────────────────
    @Groups('ORDER_AUDIT')
    @Post(':id/pagos')
    async createPartRequestPayment(
        @Param('id', ParseIntPipe) id: number,
        @Req() request: FastifyRequest,
        @User() user: any,
    ) {
        const { files, formData } = await parseMultipartRequest(request);
        const processedFiles = await processAndValidateFiles(files);

        const dto: CreatePartRequestPaymentGatewayDto = {
            id,
            monto: Number(formData.monto),
            fechaPago: formData.fechaPago || undefined,
            notas: formData.notas || undefined,
        };

        return this.partRequestsGatewayService.createPartRequestPayment(
            dto,
            serializeFilesForMicroservice(processedFiles),
            { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        );
    }

    // ─── LOGISTICA_REPUESTOS ────────────────────────────────────────
    @Groups('LOGISTICA_REPUESTOS')
    @Patch(':id/registrar-envio')
    async registrarEnvio(
        @Param('id', ParseIntPipe) id: number,
        @Req() request: FastifyRequest,
        @User() user: any,
    ) {
        const { files, formData } = await parseMultipartRequest(request);
        const processedFiles = await processAndValidateFiles(files);

        const dto: RegistrarEnvioGatewayDto = {
            id,
            transportista: formData.transportista,
            numeroGuia: formData.numeroGuia,
            fechaEstimadaLlegada: formData.fechaEstimadaLlegada || undefined,
            notas: formData.notas || undefined,
        };

        return this.partRequestsGatewayService.registrarEnvio(
            dto,
            serializeFilesForMicroservice(processedFiles),
            { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        );
    }

    // ─── LOGISTICA_REPUESTOS ────────────────────────────────────────
    @Groups('LOGISTICA_REPUESTOS')
    @Patch(':id/registrar-llegada')
    async registrarLlegada(
        @Param('id', ParseIntPipe) id: number,
        @Req() request: FastifyRequest,
        @User() user: any,
    ) {
        const { files, formData } = await parseMultipartRequest(request);
        const processedFiles = await processAndValidateFiles(files);

        const dto: RegistrarLlegadaGatewayDto = {
            id,
            cantidad: formData.cantidad ? Number(formData.cantidad) : undefined,
            precioVenta: formData.precioVenta ? Number(formData.precioVenta) : undefined,
            marca: formData.marca || undefined,
            modelo: formData.modelo || undefined,
            tipo: formData.tipo || undefined,
            color: formData.color || undefined,
            calidad: formData.calidad || undefined,
            observations: formData.observations || undefined,
        };

        return this.partRequestsGatewayService.registrarLlegada(
            dto,
            serializeFilesForMicroservice(processedFiles),
            { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        );
    }

    // ─── Cualquier logueado ────────────────────────────────────────
    @Patch(':id/aprobar-llegada')
    async aprobarLlegada(
        @Param('id', ParseIntPipe) id: number,
        @Req() request: FastifyRequest,
        @User() user: any,
    ) {
        const { files, formData } = await parseMultipartRequest(request);
        const processedFiles = await processAndValidateFiles(files);

        const dto: AprobarLlegadaGatewayDto = {
            id,
            precioVenta: formData.precioVenta ? Number(formData.precioVenta) : undefined,
        };

        return this.partRequestsGatewayService.aprobarLlegada(
            dto,
            serializeFilesForMicroservice(processedFiles),
            { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        );
    }

    // ─── Cualquier logueado ────────────────────────────────────────
    @Patch(':id/no-aprobar-llegada')
    async noAprobarLlegada(
        @Param('id', ParseIntPipe) id: number,
        @Req() request: FastifyRequest,
        @User() user: any,
    ) {
        const { files, formData } = await parseMultipartRequest(request);
        const processedFiles = await processAndValidateFiles(files);

        const dto: NoAprobarLlegadaGatewayDto = {
            id,
            motivoRechazo: formData.motivoRechazo,
        };

        return this.partRequestsGatewayService.noAprobarLlegada(
            dto,
            serializeFilesForMicroservice(processedFiles),
            { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        );
    }
}