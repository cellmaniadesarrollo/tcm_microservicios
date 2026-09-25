import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { AwsS3Service } from '../aws-s3/aws-s3.service';
import { Order } from '../order-workflow/entities/order.entity';
import { PartRequest } from './entities/part-request.entity';
import { Attachment, AttachmentEntityType } from '../order-findings/entities/attachment.entity';
import { PartRequestStatus } from './entities/enums/part-request-status.enum';
import { PartRequestStatusHistory } from './entities/part-request-status-history.entity';
import { CreatePartRequestDto } from './dto/create-part-request.dto';
import { ListPartRequestsDto } from './dto/list-part-requests.dto';
import { mapUser, enrichPartRequestAttachmentsWithSignedUrls } from './helpers/part-requests.helpers';
import { GRUPOS_CON_ACCESO_ESPERA_PAGO } from './part-request.constants';
import { PartRequestTravelItem } from './entities/part-request-travel-item.entity';

/**
 * Dueño del ciclo de vida base de PartRequest: creación, listados, lectura
 * consolidada (full data) y edición de datos complementarios.
 *
 * NO contiene: sourcing/proveedores (ver PartRequestSourcingService),
 * pagos (ver PartRequestPaymentService), ni envío/llegada/validación
 * (ver PartRequestArrivalService).
 */
@Injectable()
export class PartRequestService {
    constructor(
        @InjectRepository(PartRequest) private readonly partRequestRepo: Repository<PartRequest>,
        @InjectRepository(Attachment) private readonly attachmentRepo: Repository<Attachment>,
        @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
        @InjectRepository(PartRequestTravelItem) private readonly travelItemRepo: Repository<PartRequestTravelItem>,
        private readonly awsS3Service: AwsS3Service,
    ) { }

    async createPartRequest(
        dto: CreatePartRequestDto,
        files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>,
        user: { userId: string; companyId: string; branchId: string },
    ) {
        return this.partRequestRepo.manager.transaction(async (manager) => {
            let order: Order | null = null;

            if (dto.orderId) {
                order = await manager.findOne(Order, {
                    where: { id: dto.orderId, company_id: user.companyId },
                });

                if (!order) {
                    throw new RpcException(new NotFoundException('Orden no encontrada'));
                }
            }

            if (!dto.descripcion || dto.descripcion.trim().length < 10) {
                throw new RpcException(
                    new BadRequestException('La descripción debe tener al menos 10 caracteres'),
                );
            }

            if (!dto.marca?.trim()) {
                throw new RpcException(new BadRequestException('La marca es requerida'));
            }

            if (!dto.modelo?.trim()) {
                throw new RpcException(new BadRequestException('El modelo es requerido'));
            }

            if (!dto.tipo?.trim()) {
                throw new RpcException(new BadRequestException('El tipo de repuesto es requerido'));
            }

            if (dto.precioAcordado !== undefined && dto.precioAcordado !== null) {
                if (typeof dto.precioAcordado !== 'number' || isNaN(dto.precioAcordado) || dto.precioAcordado < 0) {
                    throw new RpcException(
                        new BadRequestException('El precio acordado debe ser un número positivo'),
                    );
                }
            }

            if (dto.posiblesLugares && dto.posiblesLugares.length > 5) {
                throw new RpcException(
                    new BadRequestException('Máximo 5 posibles lugares sugeridos'),
                );
            }

            // 1. Crear el pedido
            const partRequest = manager.create(PartRequest, {
                company_id: user.companyId,
                order_id: order?.id,
                technician_id: user.userId,
                descripcion: dto.descripcion,
                marca: dto.marca,
                modelo: dto.modelo,
                modelo_tecnico: dto.modeloTecnico,
                tipo: dto.tipo,
                color: dto.color,
                calidad: dto.calidad,
                precio_acordado: dto.precioAcordado,
                estado: PartRequestStatus.SOLICITADO,
            });

            const savedPartRequest = await manager.save(partRequest);

            // 2. Adjuntos: imágenes subidas + links sugeridos
            const attachments: Attachment[] = [];

            for (const file of files) {
                const buffer = Buffer.from(file.buffer, 'base64');
                const prefix = order
                    ? `order/${order.id}/part-requests/${savedPartRequest.id}/`
                    : `part-requests/${savedPartRequest.id}/`;

                const url = await this.awsS3Service.uploadBuffer(
                    buffer,
                    file.originalname,
                    file.mimetype,
                    prefix,
                );

                const attachment = manager.create(Attachment, {
                    entity_type: AttachmentEntityType.PART_REQUEST,
                    entity_id: savedPartRequest.id,
                    file_name: file.originalname,
                    file_url: url,
                    file_type: file.mimetype,
                    uploaded_by_id: user.userId,
                    is_public: true,
                });

                attachments.push(await manager.save(attachment));
            }

            for (const link of dto.posiblesLugares ?? []) {
                const attachment = manager.create(Attachment, {
                    entity_type: AttachmentEntityType.PART_REQUEST,
                    entity_id: savedPartRequest.id,
                    file_name: link,
                    file_url: link,
                    file_type: 'text/uri-list',
                    uploaded_by_id: user.userId,
                    is_public: true,
                });

                attachments.push(await manager.save(attachment));
            }

            // 3. Historial de estado
            const history = manager.create(PartRequestStatusHistory, {
                part_request_id: savedPartRequest.id,
                estado_anterior: null,
                estado_nuevo: PartRequestStatus.SOLICITADO,
                actor_id: user.userId,
            });
            await manager.save(history);

            // 4. Releer con relaciones eager/lazy necesarias
            const partRequestWithRelations = await manager.findOne(PartRequest, {
                where: { id: savedPartRequest.id },
            });

            const result = {
                ...partRequestWithRelations,
                technician: mapUser(partRequestWithRelations!.technician),
                responsableBusqueda: mapUser(partRequestWithRelations!.responsableBusqueda),
                responsableRecepcion: mapUser(partRequestWithRelations!.responsableRecepcion),
                attachments,
            };

            return result;
        });
    }

    async listByOrder(orderId: number, user: { companyId: string }) {
        const order = await this.orderRepo.findOne({
            where: { id: orderId, company_id: user.companyId },
        });

        if (!order) {
            throw new RpcException(new NotFoundException('Orden no encontrada'));
        }

        const partRequests = await this.partRequestRepo.find({
            where: { order_id: orderId },
            order: { createdAt: 'DESC' },
        });

        if (partRequests.length === 0) {
            return [];
        }

        const ids = partRequests.map((pr) => pr.id);
        const attachments = await this.attachmentRepo.find({
            where: { entity_type: AttachmentEntityType.PART_REQUEST, entity_id: In(ids), is_active: true },
        });

        const attachmentsByPartRequest = new Map<number, Attachment[]>();
        for (const att of attachments) {
            const list = attachmentsByPartRequest.get(att.entity_id) ?? [];
            list.push(att);
            attachmentsByPartRequest.set(att.entity_id, list);
        }

        const result = partRequests.map((pr) => ({
            ...pr,
            technician: mapUser(pr.technician),
            fecha_solicitud: pr.createdAt,
            responsableBusqueda: mapUser(pr.responsableBusqueda),
            responsableRecepcion: mapUser(pr.responsableRecepcion),
            attachments: attachmentsByPartRequest.get(pr.id) ?? [],
        }));

        await enrichPartRequestAttachmentsWithSignedUrls(result, this.awsS3Service);

        return result;
    }
    async listPartRequests(
        dto: ListPartRequestsDto,
        user: { userId: string; companyId: string },
    ) {
        const page = dto.page && dto.page > 0 ? dto.page : 1;
        const limit = dto.limit && dto.limit > 0 ? Math.min(dto.limit, 100) : 20;
        const skip = (page - 1) * limit;

        const qb = this.partRequestRepo
            .createQueryBuilder('pr')
            .leftJoinAndSelect('pr.order', 'order')
            .leftJoinAndSelect('pr.technician', 'technician')
            .leftJoinAndSelect('pr.responsableBusqueda', 'responsableBusqueda')
            .leftJoinAndSelect('pr.responsableRecepcion', 'responsableRecepcion')
            // FIX: falta este join — sin él, litigio_resuelto/fecha_resolucion/etc. nunca llegan
            .leftJoinAndSelect('pr.arrival', 'arrival')
            .leftJoinAndSelect('arrival.resueltoPor', 'resueltoPor')
            .where('pr.company_id = :companyId', { companyId: user.companyId });

        if (dto.soloMias) {
            qb.andWhere('pr.responsable_busqueda_id = :userId', { userId: user.userId });
        }

        if (dto.search?.trim()) {
            qb.andWhere('pr.descripcion ILIKE :search', { search: `%${dto.search.trim()}%` });
        }

        if (dto.estado) {
            qb.andWhere('pr.estado = :estado', { estado: dto.estado });
        }

        qb.addSelect(
            `CASE WHEN pr.estado = :estadoPrioritario THEN 0 ELSE 1 END`,
            'estado_prioridad',
        ).setParameter('estadoPrioritario', PartRequestStatus.SOLICITADO);

        qb.orderBy('estado_prioridad', 'ASC')
            .addOrderBy(dto.soloMias ? 'pr.updatedAt' : 'pr.createdAt', 'DESC');

        const [partRequests, total] = await qb
            .skip(skip)
            .take(limit)
            .getManyAndCount();

        const data = partRequests.map((pr) => ({
            ...pr,
            fecha_solicitud: pr.createdAt,
            order_number: pr.order?.order_number ?? null,
            technician: mapUser(pr.technician),
            responsableBusqueda: mapUser(pr.responsableBusqueda),
            responsableRecepcion: mapUser(pr.responsableRecepcion),
            // FIX: se deriva desde arrival, no es columna propia de PartRequest
            litigio_resuelto: pr.arrival?.resuelto ?? false,
            fecha_resolucion_litigio: pr.arrival?.fecha_resolucion ?? null,
            descripcion_resolucion_litigio: pr.arrival?.descripcion_resolucion ?? null,
        }));

        return {
            data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            filtros: {
                estados: Object.values(PartRequestStatus),
            },
        };
    }

    async getPartRequestFullData(id: number, user: { companyId: string; userGroups?: string[] }) {
        const pr = await this.partRequestRepo
            .createQueryBuilder('pr')
            .leftJoinAndSelect('pr.order', 'order')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.device', 'device')
            .leftJoinAndSelect('device.model', 'model')
            .leftJoinAndSelect('model.brand', 'brand')
            .leftJoinAndSelect('device.imeis', 'imeis')
            .leftJoinAndSelect('pr.technician', 'technician')
            .leftJoinAndSelect('pr.responsableBusqueda', 'responsableBusqueda')
            .leftJoinAndSelect('pr.responsableRecepcion', 'responsableRecepcion')
            .leftJoinAndSelect('pr.sourcing', 'sourcing')
            // ─── FIX: provider del sourcing (antes era texto libre, ahora FK) ───
            .leftJoinAndSelect('sourcing.provider', 'sourcingProvider')
            // ─── FIX: cuentas bancarias seleccionadas para el sourcing ───
            .leftJoinAndSelect('sourcing.cuentasSeleccionadas', 'cuentasSel')
            .leftJoinAndSelect('cuentasSel.providerAccount', 'providerAccount')
            .leftJoinAndSelect('pr.shipping', 'shipping')
            .leftJoinAndSelect('pr.arrival', 'arrival')
            // ─── FIX: quién resolvió el rechazo/litigio de la llegada ───
            .leftJoinAndSelect('arrival.resueltoPor', 'resueltoPor')
            // ─── allocations → payment → provider ───
            .leftJoinAndSelect('pr.pagoAllocations', 'allocations')
            .leftJoinAndSelect('allocations.payment', 'payment')
            .leftJoinAndSelect('payment.provider', 'paymentProvider')
            .leftJoinAndSelect('pr.historial', 'historial')
            .where('pr.id = :id', { id })
            .andWhere('pr.company_id = :companyId', { companyId: user.companyId })
            .orderBy('historial.fecha', 'ASC')
            .addOrderBy('payment.fecha_pago', 'ASC')
            .getOne();

        if (!pr) {
            throw new RpcException(new NotFoundException('Solicitud de repuesto no encontrada'));
        }

        // Adjuntos de la solicitud
        const attachments = await this.attachmentRepo.find({
            where: {
                entity_type: AttachmentEntityType.PART_REQUEST,
                entity_id: pr.id,
                is_active: true,
            },
            order: { createdAt: 'ASC' },
        });

        // ─── Pagos vía allocations ───
        const allocations = pr.pagoAllocations ?? [];
        const paymentIds = [...new Set(allocations.map((a) => a.payment_id).filter(Boolean))];

        const paymentAttachments = paymentIds.length
            ? await this.attachmentRepo.find({
                where: {
                    entity_type: AttachmentEntityType.PART_REQUEST_PAYMENT,
                    entity_id: In(paymentIds),
                    is_active: true,
                },
            })
            : [];

        const attachmentsByPayment = new Map<number, Attachment[]>();
        for (const att of paymentAttachments) {
            const list = attachmentsByPayment.get(att.entity_id) ?? [];
            list.push(att);
            attachmentsByPayment.set(att.entity_id, list);
        }

        // Cada ítem = lo que este pago aplicó a ESTA solicitud
        const pagos = allocations.map((a) => {
            const p = a.payment;
            return {
                allocation_id: a.id,
                payment_id: a.payment_id,
                monto_asignado: Number(a.monto_asignado), // lo que cubrió de esta solicitud
                monto_pago_total: p ? Number(p.monto) : null, // monto global del pago
                fecha_pago: p?.fecha_pago ?? null,
                notas: p?.notas ?? null,
                registrado_por_id: p?.registrado_por_id ?? null,
                provider: p?.provider
                    ? { id: p.provider.id, nombre: p.provider.nombre }
                    : null,
                attachments: attachmentsByPayment.get(a.payment_id) ?? [],
            };
        });

        // Foto(s) de la guía de envío
        let shipping: (typeof pr.shipping & { attachments: Attachment[] }) | null = null;
        if (pr.shipping) {
            const shippingAttachments = await this.attachmentRepo.find({
                where: {
                    entity_type: AttachmentEntityType.PART_REQUEST_SHIPPING,
                    entity_id: pr.shipping.id,
                    is_active: true,
                },
            });
            shipping = { ...pr.shipping, attachments: shippingAttachments };
        }

        // Fotos de llegada + validación
        let arrival: (typeof pr.arrival & {
            attachments_llegada: Attachment[];
            attachments_validacion: Attachment[];
        }) | null = null;

        if (pr.arrival) {
            const [llegadaAttachments, validacionAttachments] = await Promise.all([
                this.attachmentRepo.find({
                    where: {
                        entity_type: AttachmentEntityType.PART_REQUEST_ARRIVAL,
                        entity_id: pr.arrival.id,
                        is_active: true,
                    },
                }),
                this.attachmentRepo.find({
                    where: {
                        entity_type: AttachmentEntityType.PART_REQUEST_ARRIVAL_APPROVAL,
                        entity_id: pr.arrival.id,
                        is_active: true,
                    },
                }),
            ]);

            arrival = {
                ...pr.arrival,
                attachments_llegada: llegadaAttachments,
                attachments_validacion: validacionAttachments,
            };
        }

        // ─── Estado de pago (monto_asignado, no monto del pago completo) ───
        let montoProducto: number | null = null;
        let montoTransporte: number | null = null;
        let totalPagado: number | null = null;
        let saldoPendiente: number | null = null;
        let estadoPago: 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | null = null;

        if (pr.sourcing?.precio != null) {
            montoProducto = Number(pr.sourcing.precio) * Number(pr.sourcing.cantidad ?? 1);
            montoTransporte = Number(pr.sourcing.precio_transporte ?? 0);
            const precioTotal = montoProducto + montoTransporte;

            totalPagado = pagos.reduce((sum, p) => sum + Number(p.monto_asignado), 0);
            saldoPendiente = Number((precioTotal - totalPagado).toFixed(2));
            estadoPago = saldoPendiente <= 0 ? 'PAGADO' : totalPagado > 0 ? 'PARCIAL' : 'PENDIENTE';
        }

        const puedeVerPagos =
            user.userGroups?.some((g) =>
                ['ORDER_AUDIT', 'LOGISTICA_REPUESTOS', 'COMPANY_ADMIN', 'ADMINS'].includes(g),
            ) ?? false;

        // ─── Travel item (viajero asignado a esta solicitud) ───
        const travelItem = await this.travelItemRepo.findOne({
            where: { part_request_id: pr.id },
            relations: ['traveler', 'suggestedProvider'],
            order: { createdAt: 'DESC' },
        });

        const result: any = {
            id: pr.id,
            fecha_solicitud: pr.createdAt,
            descripcion: pr.descripcion,
            tipo: pr.tipo,
            estado: pr.estado,
            technician: mapUser(pr.technician),
            responsableBusqueda: mapUser(pr.responsableBusqueda),
            responsableRecepcion: mapUser(pr.responsableRecepcion),
            sourcing: pr.sourcing
                ? {
                    ...pr.sourcing,
                    precio:
                        puedeVerPagos && pr.sourcing.precio != null
                            ? Number(pr.sourcing.precio)
                            : null,
                    precio_transporte: puedeVerPagos
                        ? Number(pr.sourcing.precio_transporte ?? 0)
                        : null,
                    cantidad: Number(pr.sourcing.cantidad),
                    provider: pr.sourcing.provider
                        ? { id: pr.sourcing.provider.id, nombre: pr.sourcing.provider.nombre }
                        : null,
                    cuentasSeleccionadas: puedeVerPagos
                        ? (pr.sourcing.cuentasSeleccionadas ?? []).map((c) => ({
                            id: c.id,
                            monto_sugerido: c.monto_sugerido != null ? Number(c.monto_sugerido) : null,
                            providerAccount: c.providerAccount
                                ? {
                                    id: c.providerAccount.id,
                                    alias: c.providerAccount.alias ?? null,
                                    banco: c.providerAccount.banco,
                                    numero_cuenta: c.providerAccount.numero_cuenta,
                                    tipo_cuenta: c.providerAccount.tipo_cuenta,
                                    titular_cuenta: c.providerAccount.titular_cuenta,
                                }
                                : null,
                        }))
                        : [],
                }
                : null,
            shipping,
            arrival: arrival
                ? {
                    ...arrival,
                    // FIX: exponer explícitamente quién resolvió (rechazo/litigio)
                    resueltoPor: arrival.resueltoPor ? mapUser(arrival.resueltoPor) : null,
                }
                : null,
            // FIX: item de viaje asociado (si existe)
            travelItem: travelItem
                ? {
                    id: travelItem.id,
                    mode: travelItem.mode,
                    status: travelItem.status,
                    expected_quantity: travelItem.expected_quantity,
                    collected_quantity: travelItem.collected_quantity ?? null,
                    paid_cost: puedeVerPagos && travelItem.paid_cost != null
                        ? Number(travelItem.paid_cost)
                        : null,
                    office_notes: travelItem.office_notes ?? null,
                    traveler_notes: travelItem.traveler_notes ?? null,
                    collected_at: travelItem.collected_at ?? null,
                    traveler: travelItem.traveler ? mapUser(travelItem.traveler) : null,
                    suggestedProvider: travelItem.suggestedProvider
                        ? { id: travelItem.suggestedProvider.id, nombre: travelItem.suggestedProvider.nombre }
                        : null,
                }
                : null,
            order: pr.order
                ? {
                    id: pr.order.id,
                    order_number: pr.order.order_number,
                    public_id: pr.order.public_id ?? null,
                    customer: pr.order.customer
                        ? {
                            id: pr.order.customer.id,
                            firstName: pr.order.customer.firstName,
                            lastName: pr.order.customer.lastName,
                            idNumber: pr.order.customer.idNumber,
                        }
                        : null,
                    device: pr.order.device
                        ? {
                            device_id: pr.order.device.device_id,
                            serial_number: pr.order.device.serial_number ?? null,
                            color: pr.order.device.color ?? null,
                            storage: pr.order.device.storage ?? null,
                            model: pr.order.device.model
                                ? {
                                    models_name: pr.order.device.model.models_name,
                                    brand: pr.order.device.model.brand
                                        ? { brands_name: pr.order.device.model.brand.brands_name }
                                        : null,
                                }
                                : null,
                            imeis: (pr.order.device.imeis ?? []).map((i) => i.imei_number),
                        }
                        : null,
                }
                : null,
            historial: pr.historial ?? [],
            attachments,
        };

        if (puedeVerPagos) {
            result.pagos = pagos;
            result.total_pagado = totalPagado;
            result.monto_producto = montoProducto;
            result.monto_transporte = montoTransporte;
            result.saldo_pendiente = saldoPendiente;
            result.estado_pago = estadoPago;
        }

        // Firma de adjuntos
        const toSign: Array<{ id: number; attachments?: Attachment[] }> = [
            { id: result.id, attachments: result.attachments },
            ...(puedeVerPagos
                ? pagos.map((p) => ({ id: p.payment_id, attachments: p.attachments }))
                : []),
        ];
        if (shipping) toSign.push({ id: shipping.id, attachments: shipping.attachments });
        if (arrival) {
            toSign.push({ id: arrival.id, attachments: arrival.attachments_llegada });
            toSign.push({ id: arrival.id, attachments: arrival.attachments_validacion });
        }
        await enrichPartRequestAttachmentsWithSignedUrls(toSign, this.awsS3Service);

        return result;
    }

    async getPartRequestCounts(user: { companyId: string; groups?: string[] }) {
        const puedeVerEsperaPago = (user.groups || []).some(g =>
            GRUPOS_CON_ACCESO_ESPERA_PAGO.includes(g)
        );

        const [sinAceptar, esperaPago] = await Promise.all([
            this.partRequestRepo
                .createQueryBuilder('pr')
                .where('pr.company_id = :companyId', { companyId: user.companyId })
                .andWhere('pr.estado = :estado', { estado: 'SOLICITADO' })
                .andWhere('pr.responsable_busqueda_id IS NULL')
                .getCount(),

            puedeVerEsperaPago
                ? this.partRequestRepo
                    .createQueryBuilder('pr')
                    .where('pr.company_id = :companyId', { companyId: user.companyId })
                    .andWhere('pr.estado = :estado', { estado: 'ESPERA_DE_PAGO' })
                    .getCount()
                : Promise.resolve(null), // 👈 no se calcula si no tiene permiso
        ]);

        return { sinAceptar, esperaPago };
    }

    async getDatosPrevios(id: number, user: { companyId: string }) {
        const partRequest = await this.partRequestRepo
            .createQueryBuilder('pr')
            .leftJoin('pr.order', 'order')
            .addSelect(['order.id'])
            .leftJoinAndSelect('pr.sourcing', 'sourcing')
            .leftJoinAndSelect('sourcing.provider', 'provider')                     // ← necesario
            .leftJoinAndSelect('sourcing.cuentasSeleccionadas', 'cuenta')           // ← necesario
            .leftJoinAndSelect('cuenta.providerAccount', 'providerAccount')         // ← si existe esta relación
            .where('pr.id = :id', { id })
            .andWhere('pr.company_id = :companyId', { companyId: user.companyId })
            .getOne();

        if (!partRequest) {
            throw new RpcException(new NotFoundException('Solicitud de repuesto no encontrada'));
        }

        const camposFaltantes: string[] = [];
        if (!partRequest.modelo_tecnico?.trim()) camposFaltantes.push('modeloTecnico');
        if (!partRequest.color?.trim()) camposFaltantes.push('color');
        if (!partRequest.calidad?.trim()) camposFaltantes.push('calidad');
        if (!partRequest.precio_acordado) camposFaltantes.push('precioAcordado');
        if (!partRequest.precio_venta) camposFaltantes.push('precioVenta');

        return {
            id: partRequest.id,
            estado: partRequest.estado,
            marca: partRequest.marca,
            modelo: partRequest.modelo,
            modeloTecnico: partRequest.modelo_tecnico,
            tipo: partRequest.tipo,
            color: partRequest.color,
            calidad: partRequest.calidad,
            precioAcordado: partRequest.precio_acordado,
            precioVenta: partRequest.precio_venta,
            sourcing: partRequest.sourcing
                ? {
                    // Antes era "proveedor" (string), ahora es el objeto Provider
                    provider: partRequest.sourcing.provider
                        ? {
                            id: partRequest.sourcing.provider.id,
                            nombre: partRequest.sourcing.provider.nombre, // ajusta según el campo real
                        }
                        : null,

                    precio: partRequest.sourcing.precio,
                    cantidad: partRequest.sourcing.cantidad,
                    contactoProveedor: partRequest.sourcing.contacto_proveedor,
                    linkCompra: partRequest.sourcing.link_compra,
                    notas: partRequest.sourcing.notas,
                    precioTransporte: partRequest.sourcing.precio_transporte,

                    // Cuentas bancarias ahora vienen por la relación
                    cuentas: partRequest.sourcing.cuentasSeleccionadas?.map((c) => ({
                        // Ajusta estos campos según la entidad SourcingProviderAccount / ProviderAccount
                        banco: c.providerAccount?.banco,
                        numeroCuenta: c.providerAccount?.numero_cuenta,
                        tipoCuenta: c.providerAccount?.tipo_cuenta,
                        titularCuenta: c.providerAccount?.titular_cuenta,
                    })) ?? [],
                }
                : null,
            camposFaltantes,
        };
    }

    async completarDatos(
        dto: { id: number; modeloTecnico?: string; color?: string; calidad?: string; precioAcordado?: number; precioVenta?: number },
        user: { userId: string; companyId: string },
    ) {
        const partRequest = await this.partRequestRepo
            .createQueryBuilder('pr')
            .leftJoin('pr.order', 'order')
            .addSelect(['order.id'])
            .where('pr.id = :id', { id: dto.id })
            .andWhere('pr.company_id = :companyId', { companyId: user.companyId })
            .getOne();

        if (!partRequest) {
            throw new RpcException(new NotFoundException('Solicitud de repuesto no encontrada'));
        }

        if (partRequest.estado === PartRequestStatus.CANCELADO) {
            throw new RpcException(new BadRequestException('No se pueden editar datos de una solicitud cancelada'));
        }

        if (dto.modeloTecnico !== undefined) partRequest.modelo_tecnico = dto.modeloTecnico;
        if (dto.color !== undefined) partRequest.color = dto.color;
        if (dto.calidad !== undefined) partRequest.calidad = dto.calidad;
        if (dto.precioAcordado !== undefined) partRequest.precio_acordado = dto.precioAcordado;   // ← nuevo
        if (dto.precioVenta !== undefined) partRequest.precio_venta = dto.precioVenta;

        await this.partRequestRepo.save(partRequest);

        const camposFaltantes: string[] = [];
        if (!partRequest.modelo_tecnico?.trim()) camposFaltantes.push('modeloTecnico');
        if (!partRequest.color?.trim()) camposFaltantes.push('color');
        if (!partRequest.calidad?.trim()) camposFaltantes.push('calidad');
        if (!partRequest.precio_acordado) camposFaltantes.push('precioAcordado');   // ← nuevo
        if (!partRequest.precio_venta) camposFaltantes.push('precioVenta');

        return {
            id: partRequest.id,
            modeloTecnico: partRequest.modelo_tecnico,
            color: partRequest.color,
            calidad: partRequest.calidad,
            precioAcordado: partRequest.precio_acordado,   // ← nuevo
            precioVenta: partRequest.precio_venta,
            camposFaltantes,
        };
    }


    async listPagadasSinCierreOrden(
        dto: {
            page?: number;
            limit?: number;
            search?: string;
            dias?: number; // opcional, default 4
        },
        user: { companyId: string },
    ) {
        const page = dto.page && dto.page > 0 ? dto.page : 1;
        const limit = dto.limit && dto.limit > 0 ? Math.min(dto.limit, 100) : 20;
        const diasUmbral = dto.dias && dto.dias > 0 ? dto.dias : 4;

        const limiteFecha = new Date();
        limiteFecha.setDate(limiteFecha.getDate() - diasUmbral);

        // Estados de orden que se consideran "cerrados / entregados"
        const ESTADOS_CERRADOS = [7, 8]; // TRABAJO FINALIZADO, ENTREGADA

        const qb = this.partRequestRepo
            .createQueryBuilder('pr')
            .innerJoinAndSelect('pr.order', 'order')
            .leftJoinAndSelect('order.currentStatus', 'currentStatus')
            .leftJoinAndSelect('order.customer', 'customer')
            .innerJoinAndSelect('pr.sourcing', 'sourcing')
            .leftJoinAndSelect('sourcing.provider', 'provider')
            .leftJoinAndSelect('pr.pagoAllocations', 'allocations')
            .leftJoinAndSelect('allocations.payment', 'payment')
            .leftJoinAndSelect('pr.technician', 'technician')
            .leftJoinAndSelect('pr.responsableBusqueda', 'responsableBusqueda')
            .leftJoinAndSelect('pr.arrival', 'arrival') // 👈 nuevo: para saber si está en litigio y por qué
            .where('pr.company_id = :companyId', { companyId: user.companyId })
            .andWhere('pr.order_id IS NOT NULL')
            .andWhere('order.current_status_id NOT IN (:...estadosCerrados)', {
                estadosCerrados: ESTADOS_CERRADOS,
            })
            .andWhere('pr.estado != :cancelado', { cancelado: PartRequestStatus.CANCELADO });

        if (dto.search?.trim()) {
            qb.andWhere(
                `(pr.descripcion ILIKE :search
          OR provider.nombre ILIKE :search
          OR CAST(order.order_number AS TEXT) ILIKE :search)`,
                { search: `%${dto.search.trim()}%` },
            );
        }

        const partRequests = await qb.orderBy('pr.updatedAt', 'DESC').getMany();

        const enriched = partRequests
            .map((pr) => {
                const montoProducto =
                    Number(pr.sourcing?.precio ?? 0) * Number(pr.sourcing?.cantidad ?? 1);
                const montoTransporte = Number(pr.sourcing?.precio_transporte ?? 0);
                const montoTotal = montoProducto + montoTransporte;

                const allocations = pr.pagoAllocations ?? [];
                const totalPagado = allocations.reduce(
                    (sum, a) => sum + Number(a.monto_asignado),
                    0,
                );
                const saldoPendiente = Number((montoTotal - totalPagado).toFixed(2));
                const pagadaCompleta = saldoPendiente <= 0 && totalPagado > 0;

                // Fecha del último pago aplicado a esta solicitud
                const fechasPago = allocations
                    .map((a) => a.payment?.fecha_pago)
                    .filter((f): f is Date => !!f)
                    .map((f) => new Date(f).getTime());

                const fechaUltimoPago =
                    fechasPago.length > 0 ? new Date(Math.max(...fechasPago)) : null;

                const diasDesdePago = fechaUltimoPago
                    ? Math.floor(
                        (Date.now() - fechaUltimoPago.getTime()) / (1000 * 60 * 60 * 24),
                    )
                    : null;

                return {
                    pr,
                    montoProducto,
                    montoTransporte,
                    montoTotal,
                    totalPagado,
                    saldoPendiente,
                    pagadaCompleta,
                    fechaUltimoPago,
                    diasDesdePago,
                };
            })
            // Solo pagadas completas + último pago hace más de N días
            // Nota: los que están en LITIGIO se incluyen igual (no se filtran por estado != LITIGIO),
            // así siguen visibles en esta lista pero con el form bloqueado en el frontend.
            .filter(
                (e) =>
                    e.pagadaCompleta &&
                    e.fechaUltimoPago !== null &&
                    e.fechaUltimoPago <= limiteFecha,
            )
            // Las más atrasadas primero
            .sort((a, b) => (b.diasDesdePago ?? 0) - (a.diasDesdePago ?? 0));

        const total = enriched.length;
        const skip = (page - 1) * limit;
        const pageItems = enriched.slice(skip, skip + limit);

        const data = pageItems.map(
            ({
                pr,
                montoProducto,
                montoTransporte,
                montoTotal,
                totalPagado,
                saldoPendiente,
                fechaUltimoPago,
                diasDesdePago,
            }) => ({
                id: pr.id,
                descripcion: pr.descripcion,
                tipo: pr.tipo,
                estado: pr.estado, // 👈 nuevo: el frontend lo usa para saber si está en LITIGIO
                estado_solicitud: pr.estado,
                fecha_solicitud: pr.createdAt,
                fecha_ultimo_pago: fechaUltimoPago,
                dias_desde_pago: diasDesdePago,
                monto_producto: montoProducto,
                monto_transporte: montoTransporte,
                monto_total: montoTotal,
                total_pagado: totalPagado,
                saldo_pendiente: saldoPendiente,

                // 👇 nuevo: datos del litigio, si aplica
                en_litigio: pr.estado === PartRequestStatus.LITIGIO && !pr.arrival?.resuelto,
                motivo_litigio: pr.arrival?.motivo_rechazo ?? null,
                fecha_litigio: pr.arrival?.fecha_validacion ?? null,
                litigio_resuelto: pr.arrival?.resuelto ?? false,
                fecha_resolucion_litigio: pr.arrival?.fecha_resolucion ?? null,
                descripcion_resolucion_litigio: pr.arrival?.descripcion_resolucion ?? null,

                provider: pr.sourcing?.provider
                    ? {
                        id: pr.sourcing.provider.id,
                        nombre: pr.sourcing.provider.nombre,
                    }
                    : null,
                technician: mapUser(pr.technician),
                responsableBusqueda: mapUser(pr.responsableBusqueda),
                order: {
                    id: pr.order!.id,
                    order_number: pr.order!.order_number,
                    public_id: pr.order!.public_id ?? null,
                    current_status_id: pr.order!.current_status_id,
                    current_status: pr.order!.currentStatus
                        ? {
                            id: pr.order!.currentStatus.id,
                            nombre:
                                (pr.order!.currentStatus as any).name ??
                                (pr.order!.currentStatus as any).status_name ??
                                (pr.order!.currentStatus as any).label ??
                                null,
                        }
                        : null,
                    customer: pr.order!.customer
                        ? {
                            id: pr.order!.customer.id,
                            firstName: (pr.order!.customer as any).firstName ?? null,
                            lastName: (pr.order!.customer as any).lastName ?? null,
                        }
                        : null,
                },
            }),
        );

        return {
            data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 0,
                dias_umbral: diasUmbral,
            },
        };
    }
    async countPagadasSinCierreOrden(
        dto: { dias?: number; search?: string },
        user: { companyId: string },
    ) {
        const diasUmbral = dto.dias && dto.dias > 0 ? dto.dias : 4;
        const limiteFecha = new Date();
        limiteFecha.setDate(limiteFecha.getDate() - diasUmbral);

        const ESTADOS_CERRADOS = [7, 8]; // TRABAJO FINALIZADO, ENTREGADA

        const qb = this.partRequestRepo
            .createQueryBuilder('pr')
            .innerJoin('pr.order', 'order')
            .innerJoin('pr.sourcing', 'sourcing')
            .leftJoin('sourcing.provider', 'provider')
            .leftJoin('pr.pagoAllocations', 'allocations')
            .leftJoin('allocations.payment', 'payment')
            .where('pr.company_id = :companyId', { companyId: user.companyId })
            .andWhere('pr.order_id IS NOT NULL')
            .andWhere('order.current_status_id NOT IN (:...estadosCerrados)', {
                estadosCerrados: ESTADOS_CERRADOS,
            })
            .andWhere('pr.estado != :cancelado', { cancelado: PartRequestStatus.CANCELADO });

        if (dto.search?.trim()) {
            qb.andWhere(
                `(pr.descripcion ILIKE :search
              OR provider.nombre ILIKE :search
              OR CAST(order.order_number AS TEXT) ILIKE :search)`,
                { search: `%${dto.search.trim()}%` },
            );
        }

        const partRequests = await qb
            .leftJoinAndSelect('pr.pagoAllocations', 'alloc')
            .leftJoinAndSelect('alloc.payment', 'pay')
            .leftJoinAndSelect('pr.sourcing', 'src')
            .getMany();

        const total = partRequests.filter((pr) => {
            const montoProducto =
                Number(pr.sourcing?.precio ?? 0) * Number(pr.sourcing?.cantidad ?? 1);
            const montoTransporte = Number(pr.sourcing?.precio_transporte ?? 0);
            const montoTotal = montoProducto + montoTransporte;

            const allocations = pr.pagoAllocations ?? [];
            const totalPagado = allocations.reduce(
                (sum, a) => sum + Number(a.monto_asignado),
                0,
            );
            const saldoPendiente = Number((montoTotal - totalPagado).toFixed(2));
            const pagadaCompleta = saldoPendiente <= 0 && totalPagado > 0;

            const fechasPago = allocations
                .map((a) => a.payment?.fecha_pago)
                .filter((f): f is Date => !!f)
                .map((f) => new Date(f).getTime());

            const fechaUltimoPago =
                fechasPago.length > 0 ? new Date(Math.max(...fechasPago)) : null;

            return (
                pagadaCompleta &&
                fechaUltimoPago !== null &&
                fechaUltimoPago <= limiteFecha
            );
        }).length;

        return {
            total,
            dias_umbral: diasUmbral,
        };
    }
}