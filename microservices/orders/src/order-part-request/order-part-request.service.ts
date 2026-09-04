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
import { PartRequestStatus } from './entities/enums/part-request-status.enum';
import { Attachment, AttachmentEntityType } from '../order-findings/entities/attachment.entity';
import { PartRequestStatusHistory } from './entities/part-request-status-history.entity';
import { mapUser, enrichPartRequestAttachmentsWithSignedUrls } from './helpers/part-requests.helpers';
import { ListPartRequestsDto } from './dto/list-part-requests.dto';

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
        console.log(data)
        return result;
    }
    async getPartRequestFullData(id: number, user: { companyId: string }) {
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
            .leftJoinAndSelect('pr.pagos', 'pagos')
            .leftJoinAndSelect('pr.historial', 'historial')
            .where('pr.id = :id', { id })
            .andWhere('order.company_id = :companyId', { companyId: user.companyId })
            .orderBy('historial.fecha', 'ASC')
            .getOne();

        if (!pr) {
            throw new RpcException(new NotFoundException('Solicitud de repuesto no encontrada'));
        }

        // Adjuntos: carga manual, mismo patrón que el resto del módulo
        const attachments = await this.attachmentRepo.find({
            where: { entity_type: AttachmentEntityType.PART_REQUEST, entity_id: pr.id, is_active: true },
            order: { createdAt: 'ASC' },
        });

        const result = {
            id: pr.id,
            fecha_solicitud: pr.createdAt,
            descripcion: pr.descripcion,
            tipo: pr.tipo,
            estado: pr.estado,
            technician: mapUser(pr.technician),
            responsableBusqueda: mapUser(pr.responsableBusqueda),
            responsableRecepcion: mapUser(pr.responsableRecepcion),
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
            pagos: pr.pagos ?? [],
            historial: pr.historial ?? [],
            attachments,
        };

        await enrichPartRequestAttachmentsWithSignedUrls([result], this.awsS3Service);

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
}