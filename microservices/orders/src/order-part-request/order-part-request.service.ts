import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePartRequestDto } from './dto/create-part-request.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { PartRequest } from './entities/part-request.entity';
import { In, Repository } from 'typeorm';
import { AwsS3Service } from '../aws-s3/aws-s3.service';
// import { NotificationsService } from '../notifications/notifications.service';
// import { BroadcastService } from '../broadcast/broadcast.service';
import { Order } from '../order-workflow/entities/order.entity';
import { RpcException } from '@nestjs/microservices';
import { PartRequestStatus, PartRequestType } from './entities/enums/part-request-status.enum';
import { Attachment, AttachmentEntityType } from '../order-findings/entities/attachment.entity';
import { PartRequestStatusHistory } from './entities/part-request-status-history.entity';
import { mapUser, enrichPartRequestAttachmentsWithSignedUrls } from './helpers/part-requests.helpers';
import { ListPartRequestsDto } from './dto/list-part-requests.dto';
import { EncontradoNacionalDto } from './dto/encontrado-nacional.dto';
import { PartRequestSourcing } from './entities/part-request-sourcing.entity';
import { CreatePartRequestPaymentDto } from './dto/create-part-request-payment.dto';
import { PartRequestPayment } from './entities/part-request-payment.entity';
import { PartRequestShipping } from './entities/part-request-shipping.entity';
import { RegistrarEnvioGatewayDto } from './dto/registrar-envio-gateway.dto';
import { OrderPendingProduct } from '../order-extras/entities/order-pending-product.entity';
import { PartRequestArrival } from './entities/part-request-arrival.entity';
import { RegistrarLlegadaDto } from './dto/registrar-llegada.dto';
import { AprobarLlegadaDto } from './dto/aprobar-llegada.dto';
import { NoAprobarLlegadaDto } from './dto/no-aprobar-llegada.dto';

@Injectable()
export class OrderPartRequestService {
    constructor(
        @InjectRepository(PartRequest) private readonly partRequestRepo: Repository<PartRequest>,
        @InjectRepository(Attachment) private readonly attachmentRepo: Repository<Attachment>,
        @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
        private readonly awsS3Service: AwsS3Service,
        // private readonly notificationsService: NotificationsService,
        // private readonly broadcastService: BroadcastService,
    ) { }

    async createPartRequest(
        dto: CreatePartRequestDto,
        files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>,
        user: { userId: string; companyId: string; branchId: string },
    ) {
        return this.partRequestRepo.manager.transaction(async (manager) => {
            const order = await manager.findOne(Order, {
                where: { id: dto.orderId, company_id: user.companyId },
            });

            if (!order) {
                throw new RpcException(new NotFoundException('Orden no encontrada'));
            }

            if (!dto.descripcion || dto.descripcion.trim().length < 10) {
                throw new RpcException(
                    new BadRequestException('La descripción debe tener al menos 10 caracteres'),
                );
            }

            if (dto.posiblesLugares && dto.posiblesLugares.length > 5) {
                throw new RpcException(
                    new BadRequestException('Máximo 5 posibles lugares sugeridos'),
                );
            }

            // 1. Crear el pedido
            const partRequest = manager.create(PartRequest, {
                order_id: order.id,
                technician_id: user.userId,
                descripcion: dto.descripcion,
                estado: PartRequestStatus.SOLICITADO,
            });
            const savedPartRequest = await manager.save(partRequest);

            // 2. Adjuntos: imágenes subidas + links sugeridos
            const attachments: Attachment[] = [];

            for (const file of files) {
                const buffer = Buffer.from(file.buffer, 'base64');
                const prefix = `order/${order.id}/part-requests/${savedPartRequest.id}/`;
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

            // 4. Notificación + broadcast, mismo patrón que warehouse payment
            // TODO: implementar cuando se conecten eventos/notificaciones
            // await this.notificationsService.emitNotification(
            //     order.id,
            //     user.companyId,
            //     user.userId,
            //     'part_request_created',
            //     'Se registró una solicitud de repuesto',
            // );

            // await this.broadcastService.publishOrderUpdated(order.id, 'part_request_created', {
            //     partRequest: {
            //         ...savedPartRequest,
            //         attachments: attachments.map((a) => ({
            //             id: a.id,
            //             file_url: a.file_url,
            //             file_name: a.file_name,
            //         })),
            //     },
            // });

            // 5. Releer con relaciones eager (technician) pobladas
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

            // 6. Firmar URLs de los adjuntos recién creados
            //  await enrichPartRequestAttachmentsWithSignedUrls([result], this.awsS3Service);

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

    async listPartRequests(dto: ListPartRequestsDto, user: { companyId: string }) {
        const page = dto.page && dto.page > 0 ? dto.page : 1;
        const limit = dto.limit && dto.limit > 0 ? Math.min(dto.limit, 100) : 20;
        const skip = (page - 1) * limit;

        const qb = this.partRequestRepo
            .createQueryBuilder('pr')
            .leftJoinAndSelect('pr.order', 'order')
            .leftJoinAndSelect('pr.technician', 'technician')
            .leftJoinAndSelect('pr.responsableBusqueda', 'responsableBusqueda')
            .leftJoinAndSelect('pr.responsableRecepcion', 'responsableRecepcion')
            .where('order.company_id = :companyId', { companyId: user.companyId });

        if (dto.search?.trim()) {
            qb.andWhere('pr.descripcion ILIKE :search', { search: `%${dto.search.trim()}%` });
        }

        if (dto.estado) {
            qb.andWhere('pr.estado = :estado', { estado: dto.estado });
        }

        const [partRequests, total] = await qb
            .orderBy('pr.createdAt', 'DESC')
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
        }));

        const result = {
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
        // console.log(data)
        return result;
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
            .leftJoinAndSelect('pr.shipping', 'shipping')
            .leftJoinAndSelect('pr.arrival', 'arrival')
            .leftJoinAndSelect('pr.pagos', 'pagos')
            .leftJoinAndSelect('pr.historial', 'historial')
            .where('pr.id = :id', { id })
            .andWhere('order.company_id = :companyId', { companyId: user.companyId })
            .orderBy('historial.fecha', 'ASC')
            .addOrderBy('pagos.fecha_pago', 'ASC')
            .getOne();

        if (!pr) {
            throw new RpcException(new NotFoundException('Solicitud de repuesto no encontrada'));
        }

        // Adjuntos de la solicitud (imágenes, links, evidencia de encontrado-nacional)
        const attachments = await this.attachmentRepo.find({
            where: { entity_type: AttachmentEntityType.PART_REQUEST, entity_id: pr.id, is_active: true },
            order: { createdAt: 'ASC' },
        });

        // Comprobantes de cada pago
        const paymentIds = (pr.pagos ?? []).map((p) => p.id);
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

        const pagos = (pr.pagos ?? []).map((p) => ({
            ...p,
            attachments: attachmentsByPayment.get(p.id) ?? [],
        }));

        // Foto(s) de la guía de envío, si existe shipping
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

        // Fotos de llegada + fotos de validación (aprobación o rechazo), si existe arrival
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

        // Cálculo de estado de pago (mismo criterio que listParaPago)
        let totalPagado: number | null = null;
        let saldoPendiente: number | null = null;
        let estadoPago: 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | null = null;

        if (pr.sourcing?.precio) {
            const precio = Number(pr.sourcing.precio);
            totalPagado = pagos.reduce((sum, p) => sum + Number(p.monto), 0);
            saldoPendiente = Number((precio - totalPagado).toFixed(2));
            estadoPago = saldoPendiente <= 0 ? 'PAGADO' : totalPagado > 0 ? 'PARCIAL' : 'PENDIENTE';
        }

        const puedeVerPagos =
            user.userGroups?.some((g) =>
                ['ORDER_AUDIT', 'LOGISTICA_REPUESTOS', 'COMPANY_ADMIN', 'ADMINS'].includes(g),
            ) ?? false;

        // 👇 SIN pagos/total_pagado/saldo_pendiente/estado_pago en el literal inicial
        const result: any = {
            id: pr.id,
            fecha_solicitud: pr.createdAt,
            descripcion: pr.descripcion,
            tipo: pr.tipo,
            estado: pr.estado,
            technician: mapUser(pr.technician),
            responsableBusqueda: mapUser(pr.responsableBusqueda),
            responsableRecepcion: mapUser(pr.responsableRecepcion),
            sourcing: pr.sourcing ?? null,
            shipping,
            arrival,
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

        // 👇 SOLO aquí se agregan, si corresponde
        if (puedeVerPagos) {
            result.pagos = pagos;
            result.total_pagado = totalPagado;
            result.saldo_pendiente = saldoPendiente;
            result.estado_pago = estadoPago;
        }

        // Firma de adjuntos: incluye pagos SOLO si van a mostrarse
        const toSign: Array<{ id: number; attachments?: Attachment[] }> = [
            { id: result.id, attachments: result.attachments },
            ...(puedeVerPagos ? pagos : []),
        ];
        if (shipping) toSign.push({ id: shipping.id, attachments: shipping.attachments });
        if (arrival) {
            toSign.push({ id: arrival.id, attachments: arrival.attachments_llegada });
            toSign.push({ id: arrival.id, attachments: arrival.attachments_validacion });
        }
        await enrichPartRequestAttachmentsWithSignedUrls(toSign, this.awsS3Service);

        return result;
    }
    async tomarPartRequest(id: number, user: { userId: string; companyId: string }) {
        return this.partRequestRepo.manager.transaction(async (manager) => {
            // 1. Buscar el pedido validando que pertenezca a la empresa del usuario
            const partRequest = await manager
                .createQueryBuilder(PartRequest, 'pr')
                .leftJoin('pr.order', 'order')
                .addSelect(['order.id', 'order.company_id'])
                .where('pr.id = :id', { id })
                .andWhere('order.company_id = :companyId', { companyId: user.companyId })
                .getOne();

            if (!partRequest) {
                throw new RpcException(new NotFoundException('Solicitud de repuesto no encontrada'));
            }

            // 2. Validar transición de estado
            if (partRequest.estado !== PartRequestStatus.SOLICITADO) {
                throw new RpcException(
                    new BadRequestException(
                        `No se puede tomar: la solicitud ya está en estado "${partRequest.estado}"`,
                    ),
                );
            }

            const estadoAnterior = partRequest.estado;

            // 3. Actualizar el pedido
            partRequest.estado = PartRequestStatus.EN_BUSQUEDA;
            partRequest.responsable_busqueda_id = user.userId;
            await manager.save(partRequest);

            // 4. Registrar en historial
            const history = manager.create(PartRequestStatusHistory, {
                part_request_id: partRequest.id,
                estado_anterior: estadoAnterior,
                estado_nuevo: PartRequestStatus.EN_BUSQUEDA,
                actor_id: user.userId,
            });
            await manager.save(history);

            // 5. Notificación + broadcast (comentado, igual que en createPartRequest)
            // await this.notificationsService.emitNotification(...)
            // await this.broadcastService.publishOrderUpdated(...)

            // 6. Releer con relaciones eager pobladas para la respuesta
            const updated = await manager.findOne(PartRequest, { where: { id: partRequest.id } });

            return {
                ...updated,
                fecha_solicitud: updated!.createdAt,
                technician: mapUser(updated!.technician),
                responsableBusqueda: mapUser(updated!.responsableBusqueda),
                responsableRecepcion: mapUser(updated!.responsableRecepcion),
            };
        });
    }
    async listMyAcceptedPartRequests(
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
            .where('order.company_id = :companyId', { companyId: user.companyId })
            .andWhere('pr.responsable_busqueda_id = :userId', { userId: user.userId });

        if (dto.search?.trim()) {
            qb.andWhere('pr.descripcion ILIKE :search', { search: `%${dto.search.trim()}%` });
        }

        if (dto.estado) {
            qb.andWhere('pr.estado = :estado', { estado: dto.estado });
        }

        const [partRequests, total] = await qb
            .orderBy('pr.updatedAt', 'DESC')
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
    async encontradoNacional(
        dto: EncontradoNacionalDto,
        files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>,
        user: { userId: string; companyId: string },
    ) {
        return this.partRequestRepo.manager.transaction(async (manager) => {
            const partRequest = await manager
                .createQueryBuilder(PartRequest, 'pr')
                .leftJoin('pr.order', 'order')
                .addSelect(['order.id', 'order.company_id'])
                .where('pr.id = :id', { id: dto.id })
                .andWhere('order.company_id = :companyId', { companyId: user.companyId })
                .getOne();

            if (!partRequest) {
                throw new RpcException(new NotFoundException('Solicitud de repuesto no encontrada'));
            }

            if (partRequest.estado !== PartRequestStatus.EN_BUSQUEDA) {
                throw new RpcException(
                    new BadRequestException(
                        `No se puede registrar "encontrado nacional": la solicitud está en estado "${partRequest.estado}"`,
                    ),
                );
            }

            if (!dto.proveedor?.trim()) {
                throw new RpcException(new BadRequestException('El proveedor es requerido'));
            }

            if (!dto.precio || dto.precio <= 0) {
                throw new RpcException(new BadRequestException('El precio debe ser mayor a 0'));
            }

            const estadoAnterior = partRequest.estado;

            // 1. Actualizar el pedido
            partRequest.estado = PartRequestStatus.ESPERA_DE_PAGO;
            partRequest.tipo = PartRequestType.NACIONAL;
            await manager.save(partRequest);

            // 2. Guardar/actualizar sourcing (upsert, por si se corrige antes de pasar a pago)
            let sourcing = await manager.findOne(PartRequestSourcing, {
                where: { part_request_id: partRequest.id },
            });

            if (sourcing) {
                sourcing.proveedor = dto.proveedor;
                sourcing.precio = dto.precio;
                sourcing.cantidad = dto.cantidad ?? sourcing.cantidad ?? 1;
                sourcing.contacto_proveedor = dto.contactoProveedor;
                sourcing.link_compra = dto.linkCompra;
                sourcing.notas = dto.notas;
                sourcing.registrado_por_id = user.userId;
            } else {
                sourcing = manager.create(PartRequestSourcing, {
                    part_request_id: partRequest.id,
                    proveedor: dto.proveedor,
                    precio: dto.precio,
                    cantidad: dto.cantidad ?? 1,
                    contacto_proveedor: dto.contactoProveedor,
                    link_compra: dto.linkCompra,
                    notas: dto.notas,
                    registrado_por_id: user.userId,
                });
            }
            await manager.save(sourcing);

            // 3. Adjuntos: evidencia del hallazgo (fotos, capturas)
            const attachments: Attachment[] = [];
            for (const file of files) {
                const buffer = Buffer.from(file.buffer, 'base64');
                const prefix = `order/${partRequest.order_id}/part-requests/${partRequest.id}/encontrado-nacional/`;
                const url = await this.awsS3Service.uploadBuffer(
                    buffer,
                    file.originalname,
                    file.mimetype,
                    prefix,
                );

                const attachment = manager.create(Attachment, {
                    entity_type: AttachmentEntityType.PART_REQUEST,
                    entity_id: partRequest.id,
                    file_name: file.originalname,
                    file_url: url,
                    file_type: file.mimetype,
                    uploaded_by_id: user.userId,
                    is_public: true,
                });

                attachments.push(await manager.save(attachment));
            }

            // 4. Historial
            const history = manager.create(PartRequestStatusHistory, {
                part_request_id: partRequest.id,
                estado_anterior: estadoAnterior,
                estado_nuevo: PartRequestStatus.ESPERA_DE_PAGO,
                actor_id: user.userId,
                notas: dto.notas,
            });
            await manager.save(history);

            // 5. Notificación + broadcast (pendiente, igual que el resto del módulo)
            // await this.notificationsService.emitNotification(...)
            // await this.broadcastService.publishOrderUpdated(...)

            const updated = await manager.findOne(PartRequest, { where: { id: partRequest.id } });
            if (!updated) {
                throw new RpcException(new NotFoundException('Solicitud de repuesto no encontrada tras actualizar'));
            }

            const result = {
                ...updated,
                fecha_solicitud: updated!.createdAt,
                technician: mapUser(updated!.technician),
                responsableBusqueda: mapUser(updated!.responsableBusqueda),
                responsableRecepcion: mapUser(updated!.responsableRecepcion),
                sourcing,
                attachments,
            };

            await enrichPartRequestAttachmentsWithSignedUrls([result], this.awsS3Service);

            return result;
        });
    }
    async listParaPago(
        dto: ListPartRequestsDto & { filtro?: 'pendientes' | 'pagados' | 'todos' },
        user: { companyId: string },
    ) {
        const page = dto.page && dto.page > 0 ? dto.page : 1;
        const limit = dto.limit && dto.limit > 0 ? Math.min(dto.limit, 100) : 20;

        const qb = this.partRequestRepo
            .createQueryBuilder('pr')
            .innerJoin('pr.order', 'order')
            .innerJoinAndSelect('pr.sourcing', 'sourcing') // solo pedidos que ya tienen precio
            .leftJoinAndSelect('pr.pagos', 'pagos')
            .leftJoinAndSelect('pr.technician', 'technician')
            .leftJoinAndSelect('pr.responsableBusqueda', 'responsableBusqueda')
            .addSelect(['order.id', 'order.order_number'])
            .where('order.company_id = :companyId', { companyId: user.companyId })
            .andWhere('pr.estado != :cancelado', { cancelado: PartRequestStatus.CANCELADO });

        if (dto.search?.trim()) {
            qb.andWhere(
                '(pr.descripcion ILIKE :search OR sourcing.proveedor ILIKE :search)',
                { search: `%${dto.search.trim()}%` },
            );
        }

        const partRequests = await qb.orderBy('pr.updatedAt', 'DESC').getMany();

        // Cálculo de pago por pedido
        const enriched = partRequests.map((pr) => {
            const precio = Number(pr.sourcing?.precio);
            const totalPagado = (pr.pagos ?? []).reduce((sum, p) => sum + Number(p.monto), 0);
            const saldoPendiente = Number((precio - totalPagado).toFixed(2));
            const estadoPago =
                saldoPendiente <= 0 ? 'PAGADO' : totalPagado > 0 ? 'PARCIAL' : 'PENDIENTE';

            return { pr, precio, totalPagado, saldoPendiente, estadoPago };
        });

        // Filtro por condición de pago (combobox)
        const filtro = dto.filtro ?? 'todos';
        const filtered = enriched.filter((e) => {
            if (filtro === 'pendientes') return e.estadoPago !== 'PAGADO';
            if (filtro === 'pagados') return e.estadoPago === 'PAGADO';
            return true; // 'todos'
        });

        // Paginación en memoria (dataset de negocio, no masivo)
        const total = filtered.length;
        const skip = (page - 1) * limit;
        const pageItems = filtered.slice(skip, skip + limit);

        // Comprobantes de los pagos de esta página
        const paymentIds = pageItems.flatMap((e) => (e.pr.pagos ?? []).map((p) => p.id));
        const attachments = paymentIds.length
            ? await this.attachmentRepo.find({
                where: {
                    entity_type: AttachmentEntityType.PART_REQUEST_PAYMENT,
                    entity_id: In(paymentIds),
                    is_active: true,
                },
            })
            : [];

        const attachmentsByPayment = new Map<number, Attachment[]>();
        for (const att of attachments) {
            const list = attachmentsByPayment.get(att.entity_id) ?? [];
            list.push(att);
            attachmentsByPayment.set(att.entity_id, list);
        }

        const data = pageItems.map(({ pr, precio, totalPagado, saldoPendiente, estadoPago }) => ({
            id: pr.id,
            order_id: pr.order_id,
            order_number: (pr as any).order?.order_number ?? null,
            fecha_solicitud: pr.createdAt,
            descripcion: pr.descripcion,
            tipo: pr.tipo,
            estado: pr.estado,
            technician: mapUser(pr.technician),
            responsableBusqueda: mapUser(pr.responsableBusqueda),
            sourcing: {
                id: pr.sourcing?.id,
                proveedor: pr.sourcing?.proveedor,
                precio: pr.sourcing?.precio,
                cantidad: pr.sourcing?.cantidad,
                link_compra: pr.sourcing?.link_compra,
            },
            pagos: (pr.pagos ?? [])
                .sort((a, b) => a.fecha_pago.getTime() - b.fecha_pago.getTime())
                .map((p) => ({
                    ...p,
                    attachments: attachmentsByPayment.get(p.id) ?? [],
                })),
            total_pagado: totalPagado,
            saldo_pendiente: saldoPendiente,
            estado_pago: estadoPago,
        }));

        await enrichPartRequestAttachmentsWithSignedUrls(
            data.flatMap((d) => d.pagos), // firma comprobantes de todos los pagos de la página
            this.awsS3Service,
        );

        return {
            data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
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
            const partRequest = await manager
                .createQueryBuilder(PartRequest, 'pr')
                .leftJoin('pr.order', 'order')
                .addSelect(['order.id', 'order.company_id'])
                .leftJoinAndSelect('pr.sourcing', 'sourcing')
                .where('pr.id = :id', { id: dto.id })
                .andWhere('order.company_id = :companyId', { companyId: user.companyId })
                .getOne();

            if (!partRequest) {
                throw new RpcException(new NotFoundException('Solicitud de repuesto no encontrada'));
            }

            if (partRequest.estado !== PartRequestStatus.ESPERA_DE_PAGO) {
                throw new RpcException(
                    new BadRequestException(
                        `No se puede registrar un pago: la solicitud está en estado "${partRequest.estado}"`,
                    ),
                );
            }

            if (!dto.monto || dto.monto <= 0) {
                throw new RpcException(new BadRequestException('El monto debe ser mayor a 0'));
            }

            if (!partRequest.sourcing?.precio) {
                throw new RpcException(
                    new BadRequestException('El pedido no tiene un precio registrado, no se puede procesar el pago'),
                );
            }

            // 1. Calcular saldo pendiente ANTES de este pago
            const existingPayments = await manager.find(PartRequestPayment, {
                where: { part_request_id: partRequest.id },
            });
            const totalPagadoPrevio = existingPayments.reduce((sum, p) => sum + Number(p.monto), 0);
            const precio = Number(partRequest.sourcing.precio);
            const saldoPendientePrevio = precio - totalPagadoPrevio;

            if (dto.monto > saldoPendientePrevio) {
                throw new RpcException(
                    new BadRequestException(
                        `El monto excede el saldo pendiente. Máximo permitido: ${saldoPendientePrevio.toFixed(2)}`,
                    ),
                );
            }

            // 2. Crear el pago
            const payment = manager.create(PartRequestPayment, {
                part_request_id: partRequest.id,
                monto: dto.monto,
                fecha_pago: dto.fechaPago ? new Date(dto.fechaPago) : new Date(),
                registrado_por_id: user.userId,
                notas: dto.notas,
            });
            const savedPayment = await manager.save(payment);

            // 3. Comprobante(s)
            const attachments: Attachment[] = [];
            for (const file of files) {
                const buffer = Buffer.from(file.buffer, 'base64');
                const prefix = `order/${partRequest.order_id}/part-requests/${partRequest.id}/pagos/${savedPayment.id}/`;
                const url = await this.awsS3Service.uploadBuffer(
                    buffer,
                    file.originalname,
                    file.mimetype,
                    prefix,
                );

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

            // 4. Recalcular saldo con este pago incluido
            const totalPagado = totalPagadoPrevio + Number(dto.monto);
            const saldoPendiente = precio - totalPagado;
            const pagoCompleto = saldoPendiente === 0;

            // 5. Si se completó el pago, cerrar y avanzar de estado
            if (pagoCompleto) {
                const estadoAnterior = partRequest.estado;
                partRequest.estado = PartRequestStatus.EN_PROCESO_DE_PEDIDO;
                await manager.save(partRequest);

                const history = manager.create(PartRequestStatusHistory, {
                    part_request_id: partRequest.id,
                    estado_anterior: estadoAnterior,
                    estado_nuevo: PartRequestStatus.EN_PROCESO_DE_PEDIDO,
                    actor_id: user.userId,
                    notas: 'Pago completado automáticamente',
                });
                await manager.save(history);
            }

            // 6. Notificación + broadcast (pendiente, igual que el resto del módulo)
            // await this.notificationsService.emitNotification(...)
            // await this.broadcastService.publishOrderUpdated(...)

            const result = {
                ...savedPayment,
                attachments,
                total_pagado: totalPagado,
                saldo_pendiente: saldoPendiente,
                pago_completo: pagoCompleto,
                estado_pedido: pagoCompleto ? PartRequestStatus.EN_PROCESO_DE_PEDIDO : partRequest.estado,
            };

            await enrichPartRequestAttachmentsWithSignedUrls([result], this.awsS3Service);

            return result;
        });
    }
    async registrarEnvio(
        dto: RegistrarEnvioGatewayDto,
        files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>,
        user: { userId: string; companyId: string },
    ) {
        return this.partRequestRepo.manager.transaction(async (manager) => {
            const partRequest = await manager
                .createQueryBuilder(PartRequest, 'pr')
                .leftJoin('pr.order', 'order')
                .addSelect(['order.id', 'order.company_id'])
                .where('pr.id = :id', { id: dto.id })
                .andWhere('order.company_id = :companyId', { companyId: user.companyId })
                .getOne();

            if (!partRequest) {
                throw new RpcException(new NotFoundException('Solicitud de repuesto no encontrada'));
            }

            if (partRequest.estado !== PartRequestStatus.EN_PROCESO_DE_PEDIDO) {
                throw new RpcException(
                    new BadRequestException(
                        `No se puede registrar el envío: la solicitud está en estado "${partRequest.estado}"`,
                    ),
                );
            }

            if (!dto.transportista?.trim() || !dto.numeroGuia?.trim()) {
                throw new RpcException(
                    new BadRequestException('Transportista y número de guía son requeridos'),
                );
            }

            if (!files.length) {
                throw new RpcException(
                    new BadRequestException('Debes adjuntar la foto de la guía/documento de transporte'),
                );
            }

            const estadoAnterior = partRequest.estado;

            // 1. Actualizar estado del pedido
            partRequest.estado = PartRequestStatus.EN_TRANSITO;
            await manager.save(partRequest);

            // 2. Crear registro de shipping (upsert por si se corrige después)
            let shipping = await manager.findOne(PartRequestShipping, {
                where: { part_request_id: partRequest.id },
            });

            if (shipping) {
                shipping.transportista = dto.transportista;
                shipping.numero_guia = dto.numeroGuia;
                shipping.fecha_estimada_llegada = dto.fechaEstimadaLlegada
                    ? new Date(dto.fechaEstimadaLlegada)
                    : shipping.fecha_estimada_llegada;
                shipping.notas = dto.notas;
                shipping.registrado_por_id = user.userId;
            } else {
                shipping = manager.create(PartRequestShipping, {
                    part_request_id: partRequest.id,
                    transportista: dto.transportista,
                    numero_guia: dto.numeroGuia,
                    fecha_estimada_llegada: dto.fechaEstimadaLlegada
                        ? new Date(dto.fechaEstimadaLlegada)
                        : undefined,
                    notas: dto.notas,
                    registrado_por_id: user.userId,
                });
            }
            const savedShipping = await manager.save(shipping);

            // 3. Foto(s) de la guía
            const attachments: Attachment[] = [];
            for (const file of files) {
                const buffer = Buffer.from(file.buffer, 'base64');
                const prefix = `order/${partRequest.order_id}/part-requests/${partRequest.id}/shipping/`;
                const url = await this.awsS3Service.uploadBuffer(
                    buffer,
                    file.originalname,
                    file.mimetype,
                    prefix,
                );

                const attachment = manager.create(Attachment, {
                    entity_type: AttachmentEntityType.PART_REQUEST_SHIPPING,
                    entity_id: savedShipping.id,
                    file_name: file.originalname,
                    file_url: url,
                    file_type: file.mimetype,
                    uploaded_by_id: user.userId,
                    is_public: true,
                });

                attachments.push(await manager.save(attachment));
            }

            // 4. Historial
            const history = manager.create(PartRequestStatusHistory, {
                part_request_id: partRequest.id,
                estado_anterior: estadoAnterior,
                estado_nuevo: PartRequestStatus.EN_TRANSITO,
                actor_id: user.userId,
                notas: dto.notas,
            });
            await manager.save(history);

            // 5. Notificación + broadcast (pendiente, igual que el resto del módulo)
            // await this.notificationsService.emitNotification(...)
            // await this.broadcastService.publishOrderUpdated(...)

            const result = {
                ...shipping,
                attachments,
                estado_pedido: PartRequestStatus.EN_TRANSITO,
            };

            await enrichPartRequestAttachmentsWithSignedUrls([result], this.awsS3Service);

            return result;
        });
    }

    async registrarLlegada(
        dto: RegistrarLlegadaDto,
        files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>,
        user: { userId: string; companyId: string },
    ) {
        return this.partRequestRepo.manager.transaction(async (manager) => {
            const partRequest = await manager
                .createQueryBuilder(PartRequest, 'pr')
                .leftJoin('pr.order', 'order')
                .addSelect(['order.id', 'order.company_id'])
                .where('pr.id = :id', { id: dto.id })
                .andWhere('order.company_id = :companyId', { companyId: user.companyId })
                .getOne();

            if (!partRequest) {
                throw new RpcException(new NotFoundException('Solicitud de repuesto no encontrada'));
            }

            const estadosValidos = [PartRequestStatus.EN_PROCESO_DE_PEDIDO, PartRequestStatus.EN_TRANSITO];
            if (!estadosValidos.includes(partRequest.estado)) {
                throw new RpcException(
                    new BadRequestException(
                        `No se puede registrar la llegada: la solicitud está en estado "${partRequest.estado}"`,
                    ),
                );
            }

            if (!files.length) {
                throw new RpcException(
                    new BadRequestException('Debes adjuntar al menos una imagen como evidencia de la llegada'),
                );
            }

            const estadoAnterior = partRequest.estado;

            // 1. Actualizar estado
            partRequest.estado = PartRequestStatus.LLEGADO_PENDIENTE_VALIDACION;
            await manager.save(partRequest);

            // 2. Crear/actualizar registro de llegada
            let arrival = await manager.findOne(PartRequestArrival, {
                where: { part_request_id: partRequest.id },
            });

            const arrivalData = {
                cantidad: dto.cantidad ?? 1,
                precio_venta: dto.precioVenta,
                marca: dto.marca,
                modelo: dto.modelo,
                tipo: dto.tipo,
                color: dto.color,
                calidad: dto.calidad,
                observations: dto.observations,
                registrado_por_id: user.userId,
                resultado_validacion: 'PENDIENTE' as const,
            };

            if (arrival) {
                Object.assign(arrival, arrivalData);
            } else {
                arrival = manager.create(PartRequestArrival, {
                    part_request_id: partRequest.id,
                    ...arrivalData,
                });
            }
            const savedArrival = await manager.save(arrival);

            // 3. Fotos de evidencia de llegada
            const attachments: Attachment[] = [];
            for (const file of files) {
                const buffer = Buffer.from(file.buffer, 'base64');
                const prefix = `order/${partRequest.order_id}/part-requests/${partRequest.id}/arrival/`;
                const url = await this.awsS3Service.uploadBuffer(buffer, file.originalname, file.mimetype, prefix);

                const attachment = manager.create(Attachment, {
                    entity_type: AttachmentEntityType.PART_REQUEST_ARRIVAL,
                    entity_id: savedArrival.id,
                    file_name: file.originalname,
                    file_url: url,
                    file_type: file.mimetype,
                    uploaded_by_id: user.userId,
                    is_public: true,
                });

                attachments.push(await manager.save(attachment));
            }

            // 4. Historial
            const history = manager.create(PartRequestStatusHistory, {
                part_request_id: partRequest.id,
                estado_anterior: estadoAnterior,
                estado_nuevo: PartRequestStatus.LLEGADO_PENDIENTE_VALIDACION,
                actor_id: user.userId,
                notas: dto.observations,
            });
            await manager.save(history);

            // 5. Notificación + broadcast (pendiente)
            // await this.notificationsService.emitNotification(...)
            // await this.broadcastService.publishOrderUpdated(...)

            const result = { ...savedArrival, attachments, estado_pedido: partRequest.estado };
            await enrichPartRequestAttachmentsWithSignedUrls([result], this.awsS3Service);

            return result;
        });
    }
    async aprobarLlegada(
        dto: AprobarLlegadaDto,
        files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>,
        user: { userId: string; companyId: string },
    ) {
        return this.partRequestRepo.manager.transaction(async (manager) => {
            const partRequest = await manager
                .createQueryBuilder(PartRequest, 'pr')
                .leftJoinAndSelect('pr.order', 'order')
                .leftJoinAndSelect('pr.sourcing', 'sourcing')
                .leftJoinAndSelect('pr.arrival', 'arrival')
                .where('pr.id = :id', { id: dto.id })
                .andWhere('order.company_id = :companyId', { companyId: user.companyId })
                .getOne();

            if (!partRequest) {
                throw new RpcException(new NotFoundException('Solicitud de repuesto no encontrada'));
            }

            if (partRequest.estado !== PartRequestStatus.LLEGADO_PENDIENTE_VALIDACION) {
                throw new RpcException(
                    new BadRequestException(
                        `No se puede aprobar: la solicitud está en estado "${partRequest.estado}"`,
                    ),
                );
            }

            if (!partRequest.arrival) {
                throw new RpcException(new BadRequestException('No hay datos de llegada registrados'));
            }

            if (!files.length) {
                throw new RpcException(
                    new BadRequestException('Debes adjuntar al menos una imagen como evidencia de aprobación'),
                );
            }

            const precioVentaFinal = dto.precioVenta ?? partRequest.arrival.precio_venta;
            if (!precioVentaFinal || precioVentaFinal <= 0) {
                throw new RpcException(
                    new BadRequestException('Debes indicar el precio de venta antes de aprobar la asignación'),
                );
            }

            const estadoAnterior = partRequest.estado;

            // 1. Marcar la validación como aprobada
            partRequest.arrival.precio_venta = precioVentaFinal;
            partRequest.arrival.resultado_validacion = 'APROBADO';
            partRequest.arrival.validado_por_id = user.userId;
            partRequest.arrival.fecha_validacion = new Date();
            await manager.save(partRequest.arrival);

            // 2. Fotos de evidencia de aprobación
            const attachments: Attachment[] = [];
            for (const file of files) {
                const buffer = Buffer.from(file.buffer, 'base64');
                const prefix = `order/${partRequest.order_id}/part-requests/${partRequest.id}/arrival-approval/`;
                const url = await this.awsS3Service.uploadBuffer(buffer, file.originalname, file.mimetype, prefix);

                const attachment = manager.create(Attachment, {
                    entity_type: AttachmentEntityType.PART_REQUEST_ARRIVAL_APPROVAL,
                    entity_id: partRequest.arrival.id,
                    file_name: file.originalname,
                    file_url: url,
                    file_type: file.mimetype,
                    uploaded_by_id: user.userId,
                    is_public: true,
                });

                attachments.push(await manager.save(attachment));
            }

            // 3. Crear la asignación a la orden — texto plano en extra_data, sin normalizar
            const pendingProduct = manager.create(OrderPendingProduct, {
                order_id: partRequest.order_id,
                company_id: user.companyId,
                name_items: partRequest.descripcion,
                observations: partRequest.arrival.observations,
                sale_price: precioVentaFinal,
                purchase_price: partRequest.sourcing?.precio ?? null,
                quantity: partRequest.arrival.cantidad,
                is_in_inventory: false,
                created_by_id: user.userId,
                extra_data: {
                    marca: partRequest.arrival.marca ?? null,
                    modelo: partRequest.arrival.modelo ?? null,
                    tipo: partRequest.arrival.tipo ?? null,
                    color: partRequest.arrival.color ?? null,
                    calidad: partRequest.arrival.calidad ?? null,
                    origen: 'PART_REQUEST',
                    part_request_id: partRequest.id,
                },
            });
            const savedPendingProduct = await manager.save(pendingProduct);

            // 4. Actualizar estado del pedido
            partRequest.estado = PartRequestStatus.LLEGADO_ASIGNADO;
            partRequest.responsable_recepcion_id = user.userId;
            await manager.save(partRequest);

            // 5. Historial
            const history = manager.create(PartRequestStatusHistory, {
                part_request_id: partRequest.id,
                estado_anterior: estadoAnterior,
                estado_nuevo: PartRequestStatus.LLEGADO_ASIGNADO,
                actor_id: user.userId,
                notas: 'Aprobado y asignado a la orden',
            });
            await manager.save(history);

            // 6. Notificación + broadcast (pendiente)
            // await this.notificationsService.emitNotification(...)
            // await this.broadcastService.publishOrderUpdated(...)

            const result = {
                arrival: partRequest.arrival,
                pendingProduct: savedPendingProduct,
                attachments,
                estado_pedido: partRequest.estado,
            };

            await enrichPartRequestAttachmentsWithSignedUrls(
                [{ id: partRequest.arrival.id, attachments }],
                this.awsS3Service,
            );

            return result;
        });
    }
    async noAprobarLlegada(
        dto: NoAprobarLlegadaDto,
        files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>,
        user: { userId: string; companyId: string },
    ) {
        return this.partRequestRepo.manager.transaction(async (manager) => {
            const partRequest = await manager
                .createQueryBuilder(PartRequest, 'pr')
                .leftJoin('pr.order', 'order')
                .addSelect(['order.id', 'order.company_id'])
                .leftJoinAndSelect('pr.arrival', 'arrival')
                .where('pr.id = :id', { id: dto.id })
                .andWhere('order.company_id = :companyId', { companyId: user.companyId })
                .getOne();

            if (!partRequest) {
                throw new RpcException(new NotFoundException('Solicitud de repuesto no encontrada'));
            }

            if (partRequest.estado !== PartRequestStatus.LLEGADO_PENDIENTE_VALIDACION) {
                throw new RpcException(
                    new BadRequestException(
                        `No se puede rechazar: la solicitud está en estado "${partRequest.estado}"`,
                    ),
                );
            }

            if (!partRequest.arrival) {
                throw new RpcException(new BadRequestException('No hay datos de llegada registrados'));
            }

            if (!dto.motivoRechazo?.trim()) {
                throw new RpcException(new BadRequestException('El motivo de rechazo es requerido'));
            }

            if (!files.length) {
                throw new RpcException(
                    new BadRequestException('Debes adjuntar al menos una imagen como evidencia del rechazo'),
                );
            }

            const estadoAnterior = partRequest.estado;

            // 1. Marcar la validación como rechazada
            partRequest.arrival.resultado_validacion = 'RECHAZADO';
            partRequest.arrival.validado_por_id = user.userId;
            partRequest.arrival.fecha_validacion = new Date();
            partRequest.arrival.motivo_rechazo = dto.motivoRechazo;
            await manager.save(partRequest.arrival);

            // 2. Fotos de evidencia del rechazo
            const attachments: Attachment[] = [];
            for (const file of files) {
                const buffer = Buffer.from(file.buffer, 'base64');
                const prefix = `order/${partRequest.order_id}/part-requests/${partRequest.id}/arrival-rejection/`;
                const url = await this.awsS3Service.uploadBuffer(buffer, file.originalname, file.mimetype, prefix);

                const attachment = manager.create(Attachment, {
                    entity_type: AttachmentEntityType.PART_REQUEST_ARRIVAL_APPROVAL, // mismo tipo: evidencia de validación (aprobada o no)
                    entity_id: partRequest.arrival.id,
                    file_name: file.originalname,
                    file_url: url,
                    file_type: file.mimetype,
                    uploaded_by_id: user.userId,
                    is_public: true,
                });

                attachments.push(await manager.save(attachment));
            }

            // 3. Actualizar estado del pedido
            partRequest.estado = PartRequestStatus.LLEGADO_RECHAZADO;
            await manager.save(partRequest);

            // 4. Historial
            const history = manager.create(PartRequestStatusHistory, {
                part_request_id: partRequest.id,
                estado_anterior: estadoAnterior,
                estado_nuevo: PartRequestStatus.LLEGADO_RECHAZADO,
                actor_id: user.userId,
                notas: dto.motivoRechazo,
            });
            await manager.save(history);

            // 5. Notificación + broadcast (pendiente)
            // await this.notificationsService.emitNotification(...)
            // await this.broadcastService.publishOrderUpdated(...)

            const result = {
                ...partRequest.arrival,
                attachments,
                estado_pedido: partRequest.estado,
            };

            await enrichPartRequestAttachmentsWithSignedUrls([result], this.awsS3Service);

            return result;
        });
    }
}