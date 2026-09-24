// gateway/src/orders/part-requests.controller.ts

import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
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
import { CompletarDatosPartRequestGatewayDto } from './dto/completar-datos-part-request-gateway.dto';
import { LitigioLlegadaGatewayDto } from './dto/litigio-llegada-gateway.dto';
import { ResolverLitigioGatewayDto } from './dto/resolver-litigio.gateway.dto';
import { CreatePartRequestTravelItemGatewayDto } from './dto/create-part-request-travel-item-gateway.dto';

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
        let precioAcordado: number | undefined;
        if (formData.precioAcordado) {
            const parsed = Number(formData.precioAcordado);
            if (isNaN(parsed)) {
                throw new BadRequestException('El precio acordado debe ser un número válido');
            }
            precioAcordado = parsed;
        }
        const dto: CreatePartRequestGatewayDto = {
            orderId: Number(formData.orderId),
            descripcion: formData.descripcion,
            marca: formData.marca,
            modelo: formData.modelo,
            modeloTecnico: formData.modeloTecnico || undefined,
            tipo: formData.tipo,
            color: formData.color || undefined,
            calidad: formData.calidad || undefined,
            precioAcordado: formData.precioAcordado ? Number(formData.precioAcordado) : undefined, // ← nuevo
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
            providerId: formData.providerId ? Number(formData.providerId) : undefined,
            proveedor: formData.proveedor || undefined,
            precio: Number(formData.precio),
            cantidad: formData.cantidad ? Number(formData.cantidad) : undefined,
            contactoProveedor: formData.contactoProveedor || undefined,
            linkCompra: formData.linkCompra || undefined,
            notas: formData.notas || undefined,
            precioVenta: formData.precioVenta ? Number(formData.precioVenta) : undefined,
            precioTransporte: formData.precioTransporte ? Number(formData.precioTransporte) : undefined,
            providerAccountId: formData.providerAccountId ? Number(formData.providerAccountId) : undefined,
            banco: formData.banco || undefined,
            numeroCuenta: formData.numeroCuenta || undefined,
            tipoCuenta: formData.tipoCuenta || undefined,
            titularCuenta: formData.titularCuenta || undefined,
        };

        return this.partRequestsGatewayService.encontradoNacional(
            dto,
            serializeFilesForMicroservice(processedFiles),
            { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        );
    }
    // @Groups('LOGISTICA_REPUESTOS')
    @Patch(':id/completar-datos')
    async completarDatos(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: CompletarDatosPartRequestGatewayDto,
        @User() user: any,
    ) {
        return this.partRequestsGatewayService.completarDatos(
            { ...dto, id }, // Aquí id (13) sobreescribe/inyecta el id en el objeto
            { userId: user.sub, companyId: user.companyId },
        );
    }
    // @Groups('LOGISTICA_REPUESTOS')
    @Get(':id/datos-previos')
    async datosPrevios(
        @Param('id', ParseIntPipe) id: number,
        @User() user: any,
    ) {

        return this.partRequestsGatewayService.getDatosPrevios(id, {
            companyId: user.companyId,
        });
    }
    // ─── ORDER_AUDIT ────────────────────────────────────────────────
    @Groups('ORDER_AUDIT', 'LOGISTICA_REPUESTOS')
    @Get('para-pago')
    async listParaPago(
        @Query('page') page: string,
        @Query('limit') limit: string,
        @Query('search') search: string,
        @Query('filtro') filtro: string,
        @Query('providerId') providerId: string, // NUEVO
        @User() user: any,
    ) {
        const dto = {
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            search: search || undefined,
            filtro: (filtro as 'pendientes' | 'pagados' | 'todos') || undefined,
            providerId: providerId ? Number(providerId) : undefined, // NUEVO
        };

        return this.partRequestsGatewayService.listParaPago(dto, {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
        });
    }
    @Groups('ORDER_AUDIT', 'LOGISTICA_REPUESTOS')
    @Get(':id/datos-pago')
    async datosPago(
        @Param('id', ParseIntPipe) id: number,
        @User() user: any,
    ) {
        return this.partRequestsGatewayService.getDatosPago(id, {
            companyId: user.companyId,
        });
    }
    // ─── ORDER_AUDIT ────────────────────────────────────────────────
    @Groups('ORDER_AUDIT', 'LOGISTICA_REPUESTOS')
    @Post('providers/:providerId/pagos')
    async createPartRequestPayment(
        @Param('providerId', ParseIntPipe) providerId: number,
        @Req() request: FastifyRequest,
        @User() user: any,
    ) {
        const { files, formData } = await parseMultipartRequest(request);
        const processedFiles = await processAndValidateFiles(files);

        const asignaciones = formData.asignaciones
            ? (Array.isArray(formData.asignaciones) ? formData.asignaciones : JSON.parse(formData.asignaciones))
            : [];

        const dto: CreatePartRequestPaymentGatewayDto = {
            providerId,
            monto: Number(formData.monto),
            fechaPago: formData.fechaPago || undefined,
            notas: formData.notas || undefined,
            asignaciones: asignaciones.map((a: any) => ({
                partRequestId: Number(a.partRequestId),
                montoAsignado: Number(a.montoAsignado),
                cantidadOrden:
                    a.cantidadOrden !== undefined && a.cantidadOrden !== null && a.cantidadOrden !== ''
                        ? Number(a.cantidadOrden)
                        : undefined,
            })),
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
            id
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
            motivoCategoria: formData.motivoCategoria,
            motivoRechazo: formData.motivoRechazo,
        };

        return this.partRequestsGatewayService.noAprobarLlegada(
            dto,
            serializeFilesForMicroservice(processedFiles),
            { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        );
    }
    //@Groups('LOGISTICA_REPUESTOS')
    @Get('counts')
    async getPartRequestCounts(@User() user: any) {
        return this.partRequestsGatewayService.getPartRequestCounts({
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
            groups: user.groups
        });
    }

    // gateway/src/orders/part-requests.controller.ts  (agregar este endpoint)

    @Get('providers/search')
    async searchProviders(
        @Query('q') q: string,
        @User() user: any,
    ) {
        return this.partRequestsGatewayService.searchProviders(q, {
            userId: user.sub,
            companyId: user.companyId,
        });
    }


    @Groups('ORDER_AUDIT', 'LOGISTICA_REPUESTOS')
    @Get('providers/:providerId/pendientes')
    async listPendientesPorProveedor(
        @Param('providerId', ParseIntPipe) providerId: number,
        @User() user: any,
    ) {
        return this.partRequestsGatewayService.listPendientesPorProveedor(providerId, {
            userId: user.sub,
            companyId: user.companyId,
        });
    }

    @Groups('ORDER_AUDIT', 'LOGISTICA_REPUESTOS')
    @Get('pagos/:paymentId')
    async getPaymentDetail(
        @Param('paymentId', ParseIntPipe) paymentId: number,
        @User() user: any,
    ) {
        return this.partRequestsGatewayService.getPaymentDetail(paymentId, {
            userId: user.sub,
            companyId: user.companyId,
        });
    }

    @Get('pagadas-sin-cierre')
    async listPagadasSinCierreOrden(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('dias') dias?: string,
        @User() user?: any,
    ) {
        const dto = {
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            search: search?.trim() || undefined,
            dias: dias ? Number(dias) : undefined,
        };

        return this.partRequestsGatewayService.listPagadasSinCierreOrden(dto, {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
        });
    }
    @Get('pagadas-sin-cierre/count')
    async countPagadasSinCierreOrden(
        @Query('dias') dias?: string,
        @Query('search') search?: string,
        @User() user?: any,
    ) {
        const dto = {
            dias: dias ? Number(dias) : undefined,
            search: search?.trim() || undefined,
        };

        return this.partRequestsGatewayService.countPagadasSinCierreOrden(dto, {
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
        });
    }



    @Patch(':id/litigio-llegada')
    async litigioLlegada(
        @Param('id', ParseIntPipe) id: number,
        @Req() request: FastifyRequest,
        @User() user: any,
    ) {
        const { files, formData } = await parseMultipartRequest(request);
        const processedFiles = await processAndValidateFiles(files);

        const dto: LitigioLlegadaGatewayDto = {
            id,
            motivoCategoria: formData.motivoCategoria,
            motivo: formData.motivo,
        };

        return this.partRequestsGatewayService.litigioLlegada(
            dto,
            serializeFilesForMicroservice(processedFiles),
            { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        );
    }

    // gateway controller

    @Groups('LOGISTICA_REPUESTOS', 'ORDER_AUDIT')
    @Get('litigios')
    async listLitigios(
        @Query('page') page: string,
        @Query('limit') limit: string,
        @Query('search') search: string,
        @Query('providerId') providerId: string,
        @Query('motivoCategoria') motivoCategoria: string,
        @User() user: any,
    ) {
        return this.partRequestsGatewayService.listLitigios(
            {
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined,
                search: search || undefined,
                providerId: providerId ? Number(providerId) : undefined,
                motivoCategoria: motivoCategoria || undefined,
            },
            { userId: user.sub, companyId: user.companyId },
        );
    }

    // gateway controller

    @Patch(':id/resolver-litigio')
    async resolverLitigio(
        @Param('id', ParseIntPipe) id: number,
        @Req() request: FastifyRequest,
        @User() user: any,
    ) {
        const { files, formData } = await parseMultipartRequest(request);
        const processedFiles = await processAndValidateFiles(files);

        const dto: ResolverLitigioGatewayDto = {
            id,
            descripcionResolucion: formData.descripcionResolucion,
        };

        return this.partRequestsGatewayService.resolverLitigio(
            dto,
            serializeFilesForMicroservice(processedFiles),
            { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        );
    }

    // gateway controller
    @Patch('pending-products/:id/litigar')
    async litigarDesdeProductoPendiente(
        @Param('id', ParseIntPipe) id: number,
        @Req() request: FastifyRequest,
        @User() user: any,
    ) {
        const { files, formData } = await parseMultipartRequest(request);
        const processedFiles = await processAndValidateFiles(files);

        const dto = {
            pendingProductId: id,
            motivoCategoria: formData.motivoCategoria,
            motivo: formData.motivo,
        };

        return this.partRequestsGatewayService.litigarDesdeProductoPendiente(
            dto,
            serializeFilesForMicroservice(processedFiles),
            { userId: user.sub, companyId: user.companyId, branchId: user.branchId },
        );
    }

    // @Post()
    // @Features('part-request-travel-items/part-requests')
    // createTravelItem(
    //     @Body() dto: CreatePartRequestTravelItemGatewayDto,
    //     @User() user: any,
    // ) {
    //     return this.partRequestsGatewayService.createTravelItem(dto, {
    //         userId: user.sub,
    //         companyId: user.companyId,
    //         branchId: user.branchId,
    //     });
    // }
}