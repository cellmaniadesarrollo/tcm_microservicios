import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { AwsS3Service } from '../aws-s3/aws-s3.service';
import { PartRequest } from './entities/part-request.entity';
import { Attachment, AttachmentEntityType } from '../order-findings/entities/attachment.entity';
import { PartRequestStatus } from './entities/enums/part-request-status.enum';
import { PartRequestStatusHistory } from './entities/part-request-status-history.entity';
import { PartRequestPayment } from './entities/part-request-payment.entity';
import { CreatePartRequestPaymentDto } from './dto/create-part-request-payment.dto';
import { OrderPendingProduct } from '../order-extras/entities/order-pending-product.entity';
import { Provider } from './entities/provider.entity';
import { mapUser, enrichPartRequestAttachmentsWithSignedUrls } from './helpers/part-requests.helpers';
import { PartRequestPaymentAllocation } from './entities/part-request-payment-allocation.entity';

/**
 * Dueño de la etapa de pago: listado agrupado por proveedor (cola de pago),
 * registrar un pago (con lógica de saldo/pago completo y asignación del
 * repuesto a la orden) y consultar los datos necesarios para pagar.
 */
@Injectable()
export class PartRequestPaymentService {
    constructor(
        @InjectRepository(PartRequest) private readonly partRequestRepo: Repository<PartRequest>,
        @InjectRepository(Provider) private readonly providerRepo: Repository<Provider>,
        @InjectRepository(Attachment) private readonly attachmentRepo: Repository<Attachment>,
        @InjectRepository(PartRequestPayment) private readonly paymentRepo: Repository<PartRequestPayment>,
        private readonly awsS3Service: AwsS3Service,
    ) { }

    async listParaPago(
        dto: {
            page?: number;
            limit?: number;
            search?: string;
            filtro?: 'pendientes' | 'pagados' | 'todos';
            providerId?: number; // opcional: filtrar por un proveedor
        },
        user: { companyId: string },
    ) {

        const page = dto.page && dto.page > 0 ? dto.page : 1;
        const limit = dto.limit && dto.limit > 0 ? Math.min(dto.limit, 100) : 20;
        const filtro = dto.filtro ?? 'todos';

        // Búsqueda: si viene como #123123 se interpreta como número de orden exacto
        const searchTerm = dto.search?.trim();
        const orderNumberMatch = searchTerm?.match(/^#(\d+)$/);
        const orderNumberValue = orderNumberMatch ? parseInt(orderNumberMatch[1], 10) : null;

        // ═══════════════════════════════════════════════════════════
        // CASO 1: PAGADOS → listar por PAGO (no agrupar por proveedor)
        // ═══════════════════════════════════════════════════════════
        if (filtro === 'pagados') {

            const qb = this.paymentRepo
                .createQueryBuilder('pago')
                .leftJoinAndSelect('pago.allocations', 'allocations')
                .leftJoinAndSelect('allocations.partRequest', 'partRequest')
                .leftJoinAndSelect('partRequest.order', 'prOrder')
                .leftJoinAndSelect('partRequest.technician', 'prTechnician')
                .leftJoinAndSelect('partRequest.responsableBusqueda', 'prResponsable')
                .leftJoinAndSelect('partRequest.arrival', 'prArrival')
                .innerJoinAndSelect('pago.provider', 'provider')
                .where('provider.company_id = :companyId', { companyId: user.companyId });

            if (dto.providerId) {
                qb.andWhere('pago.provider_id = :providerId', { providerId: dto.providerId });
            }

            if (orderNumberValue !== null) {
                qb.andWhere('prOrder.order_number = :orderNumber', { orderNumber: orderNumberValue });
            } else if (searchTerm) {
                qb.andWhere(
                    '(provider.nombre ILIKE :search OR pago.notas ILIKE :search)',
                    { search: `%${searchTerm}%` },
                );
            }

            // totalQb necesita los mismos joins/condiciones para que el conteo coincida con los datos
            const totalQb = this.paymentRepo
                .createQueryBuilder('pago')
                .innerJoin('pago.provider', 'provider')
                .where('provider.company_id = :companyId', { companyId: user.companyId });

            if (dto.providerId) {
                totalQb.andWhere('pago.provider_id = :providerId', { providerId: dto.providerId });
            }

            if (orderNumberValue !== null) {
                totalQb
                    .leftJoin('pago.allocations', 'allocations')
                    .leftJoin('allocations.partRequest', 'partRequest')
                    .leftJoin('partRequest.order', 'prOrder')
                    .andWhere('prOrder.order_number = :orderNumber', { orderNumber: orderNumberValue });
            } else if (searchTerm) {
                totalQb.andWhere(
                    '(provider.nombre ILIKE :search OR pago.notas ILIKE :search)',
                    { search: `%${searchTerm}%` },
                );
            }

            const totalRaw = await totalQb.select('COUNT(DISTINCT pago.id)', 'cnt').getRawOne();
            const total = Number(totalRaw?.cnt ?? 0);

            const payments = await qb
                .orderBy('pago.fecha_pago', 'DESC')
                .skip((page - 1) * limit)
                .take(limit)
                .getMany();

            const paymentIds = payments.map((p) => p.id);
            const attachments = paymentIds.length
                ? await this.attachmentRepo.find({
                    where: {
                        entity_type: AttachmentEntityType.PART_REQUEST_PAYMENT,
                        entity_id: In(paymentIds),
                        is_active: true,
                    },
                })
                : [];
            const tieneComprobante = new Set(attachments.map((a) => a.entity_id));

            const data = payments.map((p) => ({
                id: p.id,
                monto: Number(p.monto),
                fecha_pago: p.fecha_pago,
                notas: p.notas ?? null,
                cantidad_solicitudes_cubiertas: (p.allocations ?? []).length,
                tiene_comprobante: tieneComprobante.has(p.id),
                provider: p.provider
                    ? { id: p.provider.id, nombre: p.provider.nombre }
                    : null,

                solicitudes_cubiertas: (p.allocations ?? []).map((a) => ({
                    id: a.part_request_id,
                    order_id: a.partRequest?.order_id ?? null,
                    order_number: a.partRequest?.order?.order_number ?? null,
                    descripcion: a.partRequest?.descripcion ?? null,
                    fecha_solicitud: a.partRequest?.createdAt ?? null,
                    estado: a.partRequest?.estado ?? null,
                    technician: mapUser(a.partRequest?.technician),
                    responsableBusqueda: mapUser(a.partRequest?.responsableBusqueda),
                    monto_asignado: Number(a.monto_asignado),
                    fecha_litigio: a.partRequest?.arrival?.fecha_validacion ?? null,
                    motivo_litigio: a.partRequest?.arrival?.motivo_rechazo ?? null,

                    litigio_resuelto: a.partRequest?.arrival?.resuelto ?? false,
                    fecha_resolucion_litigio: a.partRequest?.arrival?.fecha_resolucion ?? null,
                    descripcion_resolucion_litigio: a.partRequest?.arrival?.descripcion_resolucion ?? null,
                })),
            }));

            return {
                data,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit) || 0,
                },
                filtros: {
                    opciones: [
                        { value: 'todos', label: 'Todos' },
                        { value: 'pendientes', label: 'Pendientes de pago' },
                        { value: 'pagados', label: 'Pagados' },
                    ],
                },
            };
        }
        // ═══════════════════════════════════════════════════════════
        // CASO 2: PENDIENTES / TODOS → agrupar por PROVEEDOR
        // ═══════════════════════════════════════════════════════════
        const qb = this.partRequestRepo
            .createQueryBuilder('pr')
            .innerJoinAndSelect('pr.sourcing', 'sourcing')
            .innerJoinAndSelect('sourcing.provider', 'provider')
            .leftJoinAndSelect('pr.order', 'order')
            .leftJoinAndSelect('pr.pagoAllocations', 'allocations')
            .leftJoinAndSelect('pr.technician', 'technician')
            .leftJoinAndSelect('pr.responsableBusqueda', 'responsableBusqueda')
            .leftJoinAndSelect('pr.arrival', 'arrival')
            .where('pr.company_id = :companyId', { companyId: user.companyId })
            .andWhere('pr.estado != :cancelado', { cancelado: PartRequestStatus.CANCELADO });

        if (dto.providerId) {
            qb.andWhere('provider.id = :providerId', { providerId: dto.providerId });
        }

        if (orderNumberValue !== null) {
            qb.andWhere('order.order_number = :orderNumber', { orderNumber: orderNumberValue });
        } else if (searchTerm) {
            qb.andWhere(
                '(pr.descripcion ILIKE :search OR provider.nombre ILIKE :search)',
                { search: `%${searchTerm}%` },
            );
        }

        const partRequests = await qb.orderBy('pr.updatedAt', 'DESC').getMany();

        const enriched = partRequests.map((pr) => {
            const montoProducto = Number(pr.sourcing?.precio ?? 0) * Number(pr.sourcing?.cantidad ?? 1);
            const montoTransporte = Number(pr.sourcing?.precio_transporte ?? 0);
            const precio = montoProducto + montoTransporte;
            const totalPagado = (pr.pagoAllocations ?? []).reduce(
                (sum, a) => sum + Number(a.monto_asignado),
                0,
            );
            const saldoPendiente = Number((precio - totalPagado).toFixed(2));
            const estadoPago =
                saldoPendiente <= 0 ? 'PAGADO' : totalPagado > 0 ? 'PARCIAL' : 'PENDIENTE';

            return { pr, montoProducto, montoTransporte, precio, totalPagado, saldoPendiente, estadoPago };
        });

        // pendientes = no PAGADO; todos = todo
        const filtered = enriched.filter((e) => {
            if (filtro === 'pendientes') return e.estadoPago !== 'PAGADO';
            return true; // 'todos'
        });

        // Agrupar por proveedor
        const porProveedor = new Map<
            number,
            {
                provider: { id: number; nombre: string };
                solicitudes: typeof filtered;
                montoTotalPendiente: number;
            }
        >();

        for (const item of filtered) {
            const provider = item.pr.sourcing!.provider!;
            const grupo = porProveedor.get(provider.id) ?? {
                provider: { id: provider.id, nombre: provider.nombre },
                solicitudes: [],
                montoTotalPendiente: 0,
            };
            grupo.solicitudes.push(item);
            grupo.montoTotalPendiente += Math.max(item.saldoPendiente, 0);
            porProveedor.set(provider.id, grupo);
        }

        const grupos = Array.from(porProveedor.values()).sort(
            (a, b) => b.montoTotalPendiente - a.montoTotalPendiente,
        );

        const total = grupos.length;
        const skip = (page - 1) * limit;
        const pageItems = grupos.slice(skip, skip + limit);

        const data = pageItems.map((g) => ({
            provider: g.provider,
            cantidadSolicitudes: g.solicitudes.length,
            montoTotalPendiente: Number(g.montoTotalPendiente.toFixed(2)),
            solicitudes: g.solicitudes.map(
                ({ pr, montoProducto, montoTransporte, totalPagado, saldoPendiente, estadoPago }) => ({
                    id: pr.id,
                    order_id: pr.order_id,
                    order_number: pr.order?.order_number ?? null,
                    fecha_solicitud: pr.createdAt,
                    descripcion: pr.descripcion,
                    tipo: pr.tipo,
                    estado: pr.estado,
                    technician: mapUser(pr.technician),
                    responsableBusqueda: mapUser(pr.responsableBusqueda),
                    monto_producto: montoProducto,
                    monto_transporte: montoTransporte,
                    total_pagado: totalPagado,
                    saldo_pendiente: saldoPendiente,
                    estado_pago: estadoPago,
                    fecha_litigio: pr.arrival?.fecha_validacion ?? null,
                    motivo_litigio: pr.arrival?.motivo_rechazo ?? null,

                    litigio_resuelto: pr.arrival?.resuelto ?? false,
                    fecha_resolucion_litigio: pr.arrival?.fecha_resolucion ?? null,
                    descripcion_resolucion_litigio: pr.arrival?.descripcion_resolucion ?? null,
                }),
            ),
        }));

        return {
            data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 0,
            },
            filtros: {
                opciones: [
                    { value: 'todos', label: 'Todos' },
                    { value: 'pendientes', label: 'Pendientes de pago' },
                    { value: 'pagados', label: 'Pagados' },
                ],
            },
        };
    }



    async createPartRequestPayment(
        dto: CreatePartRequestPaymentDto,
        files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>,
        user: { userId: string; companyId: string },
    ) {

        return this.partRequestRepo.manager.transaction(async (manager) => {
            if (!dto.asignaciones?.length) {
                throw new RpcException(new BadRequestException('Debes seleccionar al menos una solicitud a pagar'));
            }

            if (!dto.monto || dto.monto <= 0) {
                throw new RpcException(new BadRequestException('El monto debe ser mayor a 0'));
            }

            const provider = await manager.findOne(Provider, {
                where: { id: dto.providerId, company_id: user.companyId },
            });
            if (!provider) {
                throw new RpcException(new NotFoundException('Proveedor no encontrado'));
            }

            const partRequestIds = dto.asignaciones.map((a) => a.partRequestId);

            // ─── Ya NO cargamos pagoAllocations ───────────────────────────────
            const partRequests = await manager
                .createQueryBuilder(PartRequest, 'pr')
                .innerJoinAndSelect('pr.sourcing', 'sourcing')
                .where('pr.id IN (:...ids)', { ids: partRequestIds })
                .andWhere('pr.company_id = :companyId', { companyId: user.companyId })
                .getMany();

            if (partRequests.length !== partRequestIds.length) {
                throw new RpcException(new NotFoundException('Una o más solicitudes no fueron encontradas'));
            }

            // ─── Validar coincidencia: mismo proveedor + estado correcto ───────
            for (const pr of partRequests) {
                if (pr.sourcing?.provider_id !== dto.providerId) {
                    throw new RpcException(
                        new BadRequestException(`La solicitud #${pr.id} no pertenece al proveedor indicado`),
                    );
                }
                if (pr.estado !== PartRequestStatus.ESPERA_DE_PAGO) {
                    throw new RpcException(
                        new BadRequestException(
                            `La solicitud #${pr.id} está en estado "${pr.estado}", no se puede pagar`,
                        ),
                    );
                }
            }

            // ─── Validar que la suma de las líneas cuadre con el monto total ──
            const sumaAsignaciones = dto.asignaciones.reduce((sum, a) => sum + Number(a.montoAsignado), 0);
            if (Math.abs(sumaAsignaciones - Number(dto.monto)) > 0.01) {
                throw new RpcException(
                    new BadRequestException(
                        `La suma de los montos asignados (${sumaAsignaciones.toFixed(2)}) no coincide con el monto del pago (${Number(dto.monto).toFixed(2)})`,
                    ),
                );
            }

            // ─── Validar saldo por línea y determinar cuáles quedan completas ──
            const partRequestById = new Map(partRequests.map((pr) => [pr.id, pr]));
            const completasPorId = new Map<number, number | undefined>(); // partRequestId -> cantidadOrden

            for (const asign of dto.asignaciones) {
                const pr = partRequestById.get(asign.partRequestId)!;

                // ─── Total pagado previo con consulta agregada ────────────────
                const { totalPagadoPrevio } = await manager
                    .createQueryBuilder(PartRequestPaymentAllocation, 'a')
                    .select('COALESCE(SUM(a.monto_asignado), 0)', 'totalPagadoPrevio')
                    .where('a.part_request_id = :id', { id: pr.id })
                    .getRawOne();

                const montoProducto = Number(pr.sourcing!.precio ?? 0) * Number(pr.sourcing!.cantidad ?? 1);
                const montoTransporte = Number(pr.sourcing!.precio_transporte ?? 0);
                const montoTotal = montoProducto + montoTransporte;

                const saldoPendientePrevio = montoTotal - Number(totalPagadoPrevio);

                if (Number(asign.montoAsignado) > saldoPendientePrevio + 0.01) {
                    throw new RpcException(
                        new BadRequestException(
                            `El monto asignado a la solicitud #${pr.id} excede su saldo pendiente (${saldoPendientePrevio.toFixed(2)})`,
                        ),
                    );
                }

                const saldoDespues = saldoPendientePrevio - Number(asign.montoAsignado);
                const completa = Math.abs(saldoDespues) < 0.01;

                if (completa) {
                    if (pr.order_id) {
                        const precioVentaNum = Number(pr.precio_venta ?? 0);
                        const costoCompraNum = Number(pr.sourcing?.precio ?? 0);

                        if (!precioVentaNum || precioVentaNum <= 0) {
                            throw new RpcException(
                                new BadRequestException(
                                    `Debes indicar el precio de venta de la solicitud #${pr.id} antes de completar el pago`,
                                ),
                            );
                        }
                        if (precioVentaNum < costoCompraNum) {
                            throw new RpcException(
                                new BadRequestException(
                                    `El precio de venta de la solicitud #${pr.id} ($${precioVentaNum}) no puede ser menor al costo de compra ($${costoCompraNum})`,
                                ),
                            );
                        }
                        if (!asign.cantidadOrden || asign.cantidadOrden <= 0) {
                            throw new RpcException(
                                new BadRequestException(
                                    `Debes indicar la cantidad para la orden de la solicitud #${pr.id} antes de completar el pago`,
                                ),
                            );
                        }
                        if (pr.sourcing!.cantidad && asign.cantidadOrden > pr.sourcing!.cantidad) {
                            throw new RpcException(
                                new BadRequestException(
                                    `La cantidad para la orden de la solicitud #${pr.id} (${asign.cantidadOrden}) no puede ser mayor a la cantidad comprada (${pr.sourcing!.cantidad})`,
                                ),
                            );
                        }
                    }
                    // Si pr.order_id es null, se completa sin exigir nada más
                    completasPorId.set(pr.id, asign.cantidadOrden);
                }
            }

            // ─── 1. Crear el pago ──────────────────────────────────────────────
            const payment = manager.create(PartRequestPayment, {
                provider_id: dto.providerId,
                monto: dto.monto,
                fecha_pago: dto.fechaPago ? new Date(dto.fechaPago) : new Date(),
                registrado_por_id: user.userId,
                notas: dto.notas,
            });
            const savedPayment = await manager.save(payment);

            // ─── 2. Crear las allocations ───────────────────────────────────────
            for (const asign of dto.asignaciones) {
                await manager.save(
                    manager.create(PartRequestPaymentAllocation, {
                        payment_id: savedPayment.id,
                        part_request_id: asign.partRequestId,
                        monto_asignado: asign.montoAsignado,
                    }),
                );
            }

            // ─── 3. Comprobante(s) ──────────────────────────────────────────────
            const attachments: Attachment[] = [];
            for (const file of files) {
                const buffer = Buffer.from(file.buffer, 'base64');
                const prefix = `providers/${dto.providerId}/pagos/${savedPayment.id}/`;
                const url = await this.awsS3Service.uploadBuffer(buffer, file.originalname, file.mimetype, prefix);

                const attachment = manager.create(Attachment, {
                    entity_type: AttachmentEntityType.PART_REQUEST_PAYMENT,
                    entity_id: savedPayment.id,
                    file_name: file.originalname,
                    file_url: url,
                    file_type: file.mimetype,
                    uploaded_by_id: user.userId,
                    is_public: true,
                });
                attachments.push(await manager.save(attachment));
            }

            if (attachments.length) {
                savedPayment.comprobante_adjunto_id = attachments[0].id;
                await manager.save(savedPayment);
            }

            // ─── 4. Asignar a la orden (si tiene) y avanzar estado por cada línea completa ──
            const resultadosPorSolicitud: any[] = [];

            for (const asign of dto.asignaciones) {
                const pr = partRequestById.get(asign.partRequestId)!;
                const cantidadOrden = completasPorId.get(pr.id);
                const completa = completasPorId.has(pr.id);

                if (completa) {
                    let assignedPendingProduct: OrderPendingProduct | null = null;

                    if (pr.order_id) {
                        const pendingProduct = manager.create(OrderPendingProduct, {
                            order_id: pr.order_id,
                            company_id: user.companyId,
                            name_items: pr.descripcion,
                            sale_price: pr.precio_venta,
                            purchase_price: pr.sourcing!.precio,
                            quantity: cantidadOrden!,
                            is_in_inventory: false,
                            created_by_id: user.userId,
                            part_request_id: pr.id,
                            extra_data: {
                                origen: 'PART_REQUEST',
                                cantidad_comprada: pr.sourcing!.cantidad,
                                cantidad_asignada_orden: cantidadOrden,
                            },
                        });
                        assignedPendingProduct = await manager.save(pendingProduct);
                    }

                    const estadoAnterior = pr.estado;
                    pr.estado = PartRequestStatus.EN_PROCESO_DE_PEDIDO;
                    await manager.save(pr);

                    await manager.save(
                        manager.create(PartRequestStatusHistory, {
                            part_request_id: pr.id,
                            estado_anterior: estadoAnterior,
                            estado_nuevo: PartRequestStatus.EN_PROCESO_DE_PEDIDO,
                            actor_id: user.userId,
                            notas: pr.order_id
                                ? `Pago completado; repuesto asignado a la orden (${cantidadOrden} unidades)`
                                : 'Pago completado; solicitud sin orden vinculada',
                        }),
                    );

                    resultadosPorSolicitud.push({
                        part_request_id: pr.id,
                        pago_completo: true,
                        estado: pr.estado,
                        pending_product: assignedPendingProduct,
                    });
                } else {
                    resultadosPorSolicitud.push({
                        part_request_id: pr.id,
                        pago_completo: false,
                        estado: pr.estado,
                    });
                }
            }

            const result = {
                id: savedPayment.id,
                provider: { id: provider.id, nombre: provider.nombre },
                monto: Number(savedPayment.monto),
                fecha_pago: savedPayment.fecha_pago,
                notas: savedPayment.notas,
                attachments,
                solicitudes: resultadosPorSolicitud,
            };

            await enrichPartRequestAttachmentsWithSignedUrls([{ id: result.id, attachments }], this.awsS3Service);

            return result;
        });
    }

    async getDatosPago(id: number, user: { companyId: string }) {
        const partRequest = await this.partRequestRepo
            .createQueryBuilder('pr')
            .leftJoin('pr.order', 'order')
            .addSelect(['order.id'])
            .leftJoinAndSelect('pr.sourcing', 'sourcing')
            .leftJoinAndSelect('sourcing.provider', 'provider')
            .leftJoinAndSelect('sourcing.cuentasSeleccionadas', 'cuenta')
            .leftJoinAndSelect('cuenta.providerAccount', 'providerAccount')
            .where('pr.id = :id', { id })
            .andWhere('pr.company_id = :companyId', { companyId: user.companyId })
            .getOne();

        if (!partRequest) {
            throw new RpcException(new NotFoundException('Solicitud de repuesto no encontrada'));
        }

        if (partRequest.estado !== PartRequestStatus.ESPERA_DE_PAGO) {
            throw new RpcException(
                new BadRequestException(
                    `Esta solicitud no está en espera de pago (estado actual: "${partRequest.estado}")`,
                ),
            );
        }

        if (!partRequest.sourcing) {
            throw new RpcException(
                new NotFoundException('No se encontró información de compra (sourcing) para esta solicitud'),
            );
        }

        const montoProducto =
            Number(partRequest.sourcing.precio ?? 0) * Number(partRequest.sourcing.cantidad ?? 1);
        const montoTransporte = Number(partRequest.sourcing.precio_transporte ?? 0);
        const montoTotal = montoProducto + montoTransporte;

        // Tomamos la primera cuenta seleccionada (si hay más de una, puedes cambiar la lógica)
        const cuentaSeleccionada = partRequest.sourcing.cuentasSeleccionadas?.[0]?.providerAccount;

        return {
            id: partRequest.id,
            estado: partRequest.estado,
            tipo: partRequest.tipo,
            marca: partRequest.marca,
            modelo: partRequest.modelo,
            descripcion: partRequest.descripcion,

            // Ahora es el objeto Provider
            proveedor: partRequest.sourcing.provider
                ? {
                    id: partRequest.sourcing.provider.id,
                    nombre: partRequest.sourcing.provider.nombre,
                    contacto: partRequest.sourcing.provider.contacto ?? null,
                }
                : null,

            precioUnitario: Number(partRequest.sourcing.precio),
            cantidad: Number(partRequest.sourcing.cantidad),
            precioTransporte: montoTransporte,
            montoProducto,
            montoTransporte,
            montoTotal,
            contactoProveedor: partRequest.sourcing.contacto_proveedor,
            linkCompra: partRequest.sourcing.link_compra,
            notas: partRequest.sourcing.notas,

            // Datos bancarios desde ProviderAccount
            datosBancarios: cuentaSeleccionada
                ? {
                    id: cuentaSeleccionada.id,
                    alias: cuentaSeleccionada.alias ?? null,
                    banco: cuentaSeleccionada.banco,
                    numeroCuenta: cuentaSeleccionada.numero_cuenta,
                    tipoCuenta: cuentaSeleccionada.tipo_cuenta,
                    titularCuenta: cuentaSeleccionada.titular_cuenta,
                }
                : null,
        };
    }

    async listPendientesPorProveedor(providerId: number, user: { companyId: string }) {
        const provider = await this.providerRepo.findOne({
            where: { id: providerId, company_id: user.companyId },
        });

        if (!provider) {
            throw new RpcException(new NotFoundException('Proveedor no encontrado'));
        }

        const partRequests = await this.partRequestRepo
            .createQueryBuilder('pr')
            .innerJoinAndSelect('pr.sourcing', 'sourcing')
            .leftJoinAndSelect('pr.order', 'order')
            .leftJoinAndSelect('pr.pagoAllocations', 'allocations')
            .leftJoinAndSelect('pr.technician', 'technician')
            .where('pr.company_id = :companyId', { companyId: user.companyId })
            .andWhere('sourcing.provider_id = :providerId', { providerId })
            .andWhere('pr.estado != :cancelado', { cancelado: PartRequestStatus.CANCELADO })
            .orderBy('pr.createdAt', 'ASC')
            .getMany();

        const enriched = partRequests
            .map((pr) => {
                const montoProducto = Number(pr.sourcing?.precio ?? 0) * Number(pr.sourcing?.cantidad ?? 1);
                const montoTransporte = Number(pr.sourcing?.precio_transporte ?? 0);
                const montoTotal = montoProducto + montoTransporte;

                const totalPagado = (pr.pagoAllocations ?? []).reduce(
                    (sum, a) => sum + Number(a.monto_asignado),
                    0,
                );
                const saldoPendiente = Number((montoTotal - totalPagado).toFixed(2));

                return { pr, montoProducto, montoTransporte, montoTotal, totalPagado, saldoPendiente };
            })
            .filter((e) => e.saldoPendiente > 0.009); // solo lo que aún debe algo (tolerancia por redondeo)

        const solicitudes = enriched.map(
            ({ pr, montoProducto, montoTransporte, montoTotal, totalPagado, saldoPendiente }) => ({
                id: pr.id,
                order_id: pr.order_id,
                order_number: pr.order?.order_number ?? null,
                fecha_solicitud: pr.createdAt,
                descripcion: pr.descripcion,
                tipo: pr.tipo,
                estado: pr.estado,
                technician: mapUser(pr.technician),
                monto_producto: montoProducto,
                monto_transporte: montoTransporte,
                monto_total: montoTotal,
                total_pagado: totalPagado,
                saldo_pendiente: saldoPendiente,
            }),
        );

        return {
            provider: { id: provider.id, nombre: provider.nombre },
            montoTotalPendiente: Number(
                solicitudes.reduce((sum, s) => sum + s.saldo_pendiente, 0).toFixed(2),
            ),
            solicitudes,
        };
    }

    async getPaymentDetail(paymentId: number, user: { companyId: string }) {
        const payment = await this.paymentRepo
            .createQueryBuilder('pago')
            .leftJoinAndSelect('pago.provider', 'provider')
            .leftJoinAndSelect('pago.allocations', 'allocations')
            .leftJoinAndSelect('allocations.partRequest', 'pr')
            .leftJoinAndSelect('pr.order', 'order')
            .leftJoinAndSelect('pr.sourcing', 'sourcing')
            .where('pago.id = :paymentId', { paymentId })
            .andWhere('provider.company_id = :companyId', { companyId: user.companyId })
            .getOne();

        if (!payment) {
            throw new RpcException(new NotFoundException('Pago no encontrado'));
        }

        // Comprobantes
        const attachments = await this.attachmentRepo.find({
            where: {
                entity_type: AttachmentEntityType.PART_REQUEST_PAYMENT,
                entity_id: payment.id,
                is_active: true,
            },
        });

        const solicitudes = (payment.allocations ?? []).map((a) => {
            const pr = a.partRequest;
            const montoProducto =
                Number(pr?.sourcing?.precio ?? 0) * Number(pr?.sourcing?.cantidad ?? 1);
            const montoTransporte = Number(pr?.sourcing?.precio_transporte ?? 0);

            return {
                allocation_id: a.id,
                part_request_id: a.part_request_id,
                monto_asignado: Number(a.monto_asignado),
                descripcion: pr?.descripcion ?? null,
                estado: pr?.estado ?? null,
                order_id: pr?.order_id ?? null,
                order_number: pr?.order?.order_number ?? null,
                monto_producto: montoProducto,
                monto_transporte: montoTransporte,
                monto_total_solicitud: montoProducto + montoTransporte,
            };
        });

        // 👇 Attachment[] tal cual, no el mapeo final — enrichPartRequestAttachmentsWithSignedUrls
        // necesita objetos Attachment reales para poder mutar/leer su file_url
        const comprobantes = attachments.map((att) => ({
            id: att.id,
            file_name: att.file_name,
            file_url: att.file_url,
            file_type: att.file_type,
        }));

        // 👇 nuevo: firmar las URLs, mismo patrón que en resolverLitigio / getPartRequestFullData
        if (attachments.length) {
            await enrichPartRequestAttachmentsWithSignedUrls(
                [{ id: payment.id, attachments: attachments }],
                this.awsS3Service,
            );
        }

        return {
            id: payment.id,
            monto: Number(payment.monto),
            fecha_pago: payment.fecha_pago,
            notas: payment.notas ?? null,
            registrado_por_id: payment.registrado_por_id,
            provider: payment.provider
                ? { id: payment.provider.id, nombre: payment.provider.nombre }
                : null,
            cantidad_solicitudes_cubiertas: solicitudes.length,
            solicitudes,
            comprobantes: attachments.map((att) => ({ // 👈 se remapea DESPUÉS de firmar, para tomar el file_url ya actualizado
                id: att.id,
                file_name: att.file_name,
                file_url: att.file_url,
                file_type: att.file_type,
            })),
            tiene_comprobante: attachments.length > 0,
            createdAt: payment.createdAt,
        };
    }
}