import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { AwsS3Service } from '../aws-s3/aws-s3.service';
import { PartRequest } from './entities/part-request.entity';
import { Attachment, AttachmentEntityType } from '../order-findings/entities/attachment.entity';
import { PartRequestStatus } from './entities/enums/part-request-status.enum';
import { PartRequestStatusHistory } from './entities/part-request-status-history.entity';
import { PartRequestShipping } from './entities/part-request-shipping.entity';
import { RegistrarEnvioGatewayDto } from './dto/registrar-envio-gateway.dto';
import { OrderPendingProduct } from '../order-extras/entities/order-pending-product.entity';
import { PartRequestArrival } from './entities/part-request-arrival.entity';
import { RegistrarLlegadaDto } from './dto/registrar-llegada.dto';
import { AprobarLlegadaDto } from './dto/aprobar-llegada.dto';
import { NoAprobarLlegadaDto } from './dto/no-aprobar-llegada.dto';
import { enrichPartRequestAttachmentsWithSignedUrls, mapUser } from './helpers/part-requests.helpers';
import { LitigioLlegadaDto } from './dto/litigio-llegada.dto';

/**
 * Dueño de la máquina de estados post-pago: registrar envío, registrar
 * llegada, y aprobar/rechazar la validación de lo llegado.
 */
@Injectable()
export class PartRequestArrivalService {
    constructor(
        @InjectRepository(PartRequest) private readonly partRequestRepo: Repository<PartRequest>,
        private readonly awsS3Service: AwsS3Service,
    ) { }

    async registrarEnvio(
        dto: RegistrarEnvioGatewayDto,
        files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>,
        user: { userId: string; companyId: string },
    ) {
        return this.partRequestRepo.manager.transaction(async (manager) => {
            const partRequest = await manager
                .createQueryBuilder(PartRequest, 'pr')
                .leftJoin('pr.order', 'order')
                .addSelect(['order.id'])
                .where('pr.id = :id', { id: dto.id })
                .andWhere('pr.company_id = :companyId', { companyId: user.companyId })
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
                throw new RpcException(new BadRequestException('Transportista y número de guía son requeridos'));
            }

            if (!files.length) {
                throw new RpcException(
                    new BadRequestException('Debes adjuntar al menos una imagen (guía y/o evidencia de llegada)'),
                );
            }

            const estadoAnterior = partRequest.estado; // EN_PROCESO_DE_PEDIDO

            // 1. Salta directo a "pendiente de validación", ya no pasa por EN_TRANSITO
            partRequest.estado = PartRequestStatus.LLEGADO_PENDIENTE_VALIDACION;
            await manager.save(partRequest);

            // 2. Shipping
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
                    fecha_estimada_llegada: dto.fechaEstimadaLlegada ? new Date(dto.fechaEstimadaLlegada) : undefined,
                    notas: dto.notas,
                    registrado_por_id: user.userId,
                });
            }
            const savedShipping = await manager.save(shipping);

            // 3. Arrival: se crea aquí mismo (ya no hay paso separado de "registrar llegada")
            let arrival = await manager.findOne(PartRequestArrival, {
                where: { part_request_id: partRequest.id },
            });

            const arrivalData = {
                observations: dto.notas,
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

            // 4. Adjuntos: guía + evidencia de llegada en un solo lote
            const attachments: Attachment[] = [];
            for (const file of files) {
                const buffer = Buffer.from(file.buffer, 'base64');
                const prefix = `order/${partRequest.order_id}/part-requests/${partRequest.id}/envio-llegada/`;
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

            // 5. Historial: EN_PROCESO_DE_PEDIDO -> LLEGADO_PENDIENTE_VALIDACION directo
            const history = manager.create(PartRequestStatusHistory, {
                part_request_id: partRequest.id,
                estado_anterior: estadoAnterior,
                estado_nuevo: PartRequestStatus.LLEGADO_PENDIENTE_VALIDACION,
                actor_id: user.userId,
                notas: dto.notas,
            });
            await manager.save(history);

            const arrivalWithAttachments = { ...savedArrival, attachments };
            await enrichPartRequestAttachmentsWithSignedUrls([arrivalWithAttachments], this.awsS3Service);

            // 6. Notificación + broadcast (pendiente)

            return {
                shipping: savedShipping,
                arrival: arrivalWithAttachments,
                estado_pedido: partRequest.estado,
            };
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
                .leftJoinAndSelect('pr.arrival', 'arrival')
                .where('pr.id = :id', { id: dto.id })
                .andWhere('pr.company_id = :companyId', { companyId: user.companyId })
                .getOne();

            if (!partRequest) {
                throw new RpcException(new NotFoundException('Solicitud de repuesto no encontrada'));
            }

            if (partRequest.estado !== PartRequestStatus.LLEGADO_PENDIENTE_VALIDACION) {
                throw new RpcException(
                    new BadRequestException(`No se puede aprobar: la solicitud está en estado "${partRequest.estado}"`),
                );
            }

            if (!partRequest.arrival) {
                throw new RpcException(new BadRequestException('No hay datos de llegada registrados'));
            }

            // CAMBIO: ya no se exige files.length > 0

            const pendingProduct = await manager.findOne(OrderPendingProduct, {
                where: { part_request_id: partRequest.id },
            });

            // CAMBIO: solo obligatorio si la solicitud tiene orden
            if (partRequest.order_id && !pendingProduct) {
                throw new RpcException(
                    new BadRequestException('No existe una asignación a la orden; el pago debe completarse antes de aprobar la llegada'),
                );
            }

            if (pendingProduct && partRequest.arrival.cantidad < pendingProduct.quantity) {
                throw new RpcException(
                    new BadRequestException(
                        `La cantidad llegada (${partRequest.arrival.cantidad}) es menor a la cantidad ya asignada a la orden (${pendingProduct.quantity})`,
                    ),
                );
            }

            const estadoAnterior = partRequest.estado;

            partRequest.arrival.resultado_validacion = 'APROBADO';
            partRequest.arrival.validado_por_id = user.userId;
            partRequest.arrival.fecha_validacion = new Date();
            await manager.save(partRequest.arrival);

            const attachments: Attachment[] = [];
            for (const file of files) {
                const buffer = Buffer.from(file.buffer, 'base64');
                const prefix = `part-requests/${partRequest.id}/arrival-approval/`;
                const url = await this.awsS3Service.uploadBuffer(buffer, file.originalname, file.mimetype, prefix);

                attachments.push(
                    await manager.save(
                        manager.create(Attachment, {
                            entity_type: AttachmentEntityType.PART_REQUEST_ARRIVAL_APPROVAL,
                            entity_id: partRequest.arrival.id,
                            file_name: file.originalname,
                            file_url: url,
                            file_type: file.mimetype,
                            uploaded_by_id: user.userId,
                            is_public: true,
                        }),
                    ),
                );
            }

            partRequest.estado = PartRequestStatus.LLEGADO_ASIGNADO;
            partRequest.responsable_recepcion_id = user.userId;
            await manager.save(partRequest);

            await manager.save(
                manager.create(PartRequestStatusHistory, {
                    part_request_id: partRequest.id,
                    estado_anterior: estadoAnterior,
                    estado_nuevo: PartRequestStatus.LLEGADO_ASIGNADO,
                    actor_id: user.userId,
                    notas: pendingProduct
                        ? `Llegada aprobada (${partRequest.arrival.cantidad} unidades llegadas, ${pendingProduct.quantity} asignadas a la orden)`
                        : `Llegada aprobada (${partRequest.arrival.cantidad} unidades llegadas, sin orden vinculada)`,
                }),
            );

            const arrivalWithAttachments = { ...partRequest.arrival, attachments };
            if (attachments.length) {
                await enrichPartRequestAttachmentsWithSignedUrls([arrivalWithAttachments], this.awsS3Service);
            }

            return { arrival: arrivalWithAttachments, pendingProduct, estado_pedido: partRequest.estado };
        });
    }

    async cancelarPartRequest(
        dto: NoAprobarLlegadaDto, // { id, motivoCategoria, motivoRechazo }
        files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>,
        user: { userId: string; companyId: string },
    ) {
        return this.partRequestRepo.manager.transaction(async (manager) => {
            const partRequest = await manager
                .createQueryBuilder(PartRequest, 'pr')
                .leftJoinAndSelect('pr.arrival', 'arrival')
                .where('pr.id = :id', { id: dto.id })
                .andWhere('pr.company_id = :companyId', { companyId: user.companyId })
                .getOne();

            if (!partRequest) {
                throw new RpcException(new NotFoundException('Solicitud de repuesto no encontrada'));
            }

            // CAMBIO: disponible en cualquier estado, salvo si ya está cancelada
            if (partRequest.estado === PartRequestStatus.CANCELADO) {
                throw new RpcException(new BadRequestException('La solicitud ya está cancelada'));
            }

            if (!dto.motivoCategoria) {
                throw new RpcException(new BadRequestException('La categoría del motivo es requerida'));
            }
            if (!dto.motivoRechazo?.trim()) {
                throw new RpcException(new BadRequestException('El motivo es requerido'));
            }

            // CAMBIO: ya no se exige files.length > 0

            const pendingProduct = await manager.findOne(OrderPendingProduct, {
                where: { part_request_id: partRequest.id },
            });

            if (pendingProduct?.is_in_inventory) {
                throw new RpcException(
                    new BadRequestException('No se puede cancelar: el repuesto asignado ya fue movido a inventario'),
                );
            }

            const estadoAnterior = partRequest.estado;

            // 1. Si ya existe registro de llegada, se marca su validación como rechazada
            if (partRequest.arrival) {
                partRequest.arrival.resultado_validacion = 'RECHAZADO';
                partRequest.arrival.validado_por_id = user.userId;
                partRequest.arrival.fecha_validacion = new Date();
                partRequest.arrival.motivo_categoria = dto.motivoCategoria;
                partRequest.arrival.motivo_rechazo = dto.motivoRechazo;
                await manager.save(partRequest.arrival);
            }

            // 2. Si hay asignación a la orden, se elimina (softDelete) sin importar la etapa
            if (pendingProduct) {
                await manager.softDelete(OrderPendingProduct, { id: pendingProduct.id });
            }

            // 3. Adjuntos (opcionales)
            const attachments: Attachment[] = [];
            for (const file of files) {
                const buffer = Buffer.from(file.buffer, 'base64');
                const prefix = `part-requests/${partRequest.id}/cancelacion/`;
                const url = await this.awsS3Service.uploadBuffer(buffer, file.originalname, file.mimetype, prefix);

                attachments.push(
                    await manager.save(
                        manager.create(Attachment, {
                            entity_type: partRequest.arrival
                                ? AttachmentEntityType.PART_REQUEST_ARRIVAL_APPROVAL
                                : AttachmentEntityType.PART_REQUEST,
                            entity_id: partRequest.arrival ? partRequest.arrival.id : partRequest.id,
                            file_name: file.originalname,
                            file_url: url,
                            file_type: file.mimetype,
                            uploaded_by_id: user.userId,
                            is_public: true,
                        }),
                    ),
                );
            }

            // 4. Estado final generalizado
            partRequest.estado = PartRequestStatus.CANCELADO;
            await manager.save(partRequest);

            // 5. Historial
            await manager.save(
                manager.create(PartRequestStatusHistory, {
                    part_request_id: partRequest.id,
                    estado_anterior: estadoAnterior,
                    estado_nuevo: PartRequestStatus.CANCELADO,
                    actor_id: user.userId,
                    notas: pendingProduct
                        ? `${dto.motivoRechazo} (se eliminó la asignación previa a la orden #${pendingProduct.id})`
                        : dto.motivoRechazo,
                }),
            );

            const result = {
                id: partRequest.id,
                estado_pedido: partRequest.estado,
                arrival: partRequest.arrival ?? null,
                attachments,
                assignment_removed: !!pendingProduct,
            };

            if (attachments.length) {
                await enrichPartRequestAttachmentsWithSignedUrls([{ id: result.id, attachments }], this.awsS3Service);
            }

            return result;
        });
    }
    async litigioLlegada(
        dto: LitigioLlegadaDto, // { id, motivoCategoria, motivo }
        files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>,
        user: { userId: string; companyId: string },
    ) {
        return this.partRequestRepo.manager.transaction(async (manager) => {
            const partRequest = await manager
                .createQueryBuilder(PartRequest, 'pr')
                .leftJoinAndSelect('pr.arrival', 'arrival')
                .where('pr.id = :id', { id: dto.id })
                .andWhere('pr.company_id = :companyId', { companyId: user.companyId })
                .getOne();

            if (!partRequest) {
                throw new RpcException(new NotFoundException('Solicitud de repuesto no encontrada'));
            }

            const estadosValidos = [
                PartRequestStatus.LLEGADO_PENDIENTE_VALIDACION,
                PartRequestStatus.LLEGADO_ASIGNADO,
                PartRequestStatus.EN_PROCESO_DE_PEDIDO,
            ];
            if (!estadosValidos.includes(partRequest.estado)) {
                throw new RpcException(
                    new BadRequestException(`No se puede marcar en litigio: la solicitud está en estado "${partRequest.estado}"`),
                );
            }

            if (!dto.motivoCategoria) {
                throw new RpcException(new BadRequestException('La categoría del motivo es requerida'));
            }
            if (!dto.motivo?.trim()) {
                throw new RpcException(new BadRequestException('El motivo es requerido'));
            }

            // CAMBIO: ya no se exige files.length > 0

            const pendingProduct = await manager.findOne(OrderPendingProduct, {
                where: { part_request_id: partRequest.id },
            });

            if (pendingProduct?.is_in_inventory) {
                throw new RpcException(
                    new BadRequestException('No se puede marcar en litigio: el repuesto ya fue movido a inventario'),
                );
            }

            const estadoAnterior = partRequest.estado;

            // 1. Si existe registro de llegada, marcar su validación como litigio
            // (puede NO existir si viene desde EN_PROCESO_DE_PEDIDO, antes de registrar envío/llegada)
            if (partRequest.arrival) {
                partRequest.arrival.resultado_validacion = 'LITIGIO';
                partRequest.arrival.validado_por_id = user.userId;
                partRequest.arrival.fecha_validacion = new Date();
                partRequest.arrival.motivo_categoria = dto.motivoCategoria;
                partRequest.arrival.motivo_rechazo = dto.motivo;
                await manager.save(partRequest.arrival);
            }

            // 2. Eliminar (softDelete) la asignación a la orden si existe
            if (pendingProduct) {
                await manager.softDelete(OrderPendingProduct, { id: pendingProduct.id });
            }

            // 3. Adjuntos (opcionales)
            const attachments: Attachment[] = [];
            for (const file of files) {
                const buffer = Buffer.from(file.buffer, 'base64');
                const prefix = `part-requests/${partRequest.id}/litigio/`;
                const url = await this.awsS3Service.uploadBuffer(buffer, file.originalname, file.mimetype, prefix);

                attachments.push(
                    await manager.save(
                        manager.create(Attachment, {
                            entity_type: partRequest.arrival
                                ? AttachmentEntityType.PART_REQUEST_ARRIVAL_APPROVAL
                                : AttachmentEntityType.PART_REQUEST,
                            entity_id: partRequest.arrival ? partRequest.arrival.id : partRequest.id,
                            file_name: file.originalname,
                            file_url: url,
                            file_type: file.mimetype,
                            uploaded_by_id: user.userId,
                            is_public: true,
                        }),
                    ),
                );
            }

            // 4. Estado
            partRequest.estado = PartRequestStatus.LITIGIO;
            await manager.save(partRequest);

            // 5. Historial
            await manager.save(
                manager.create(PartRequestStatusHistory, {
                    part_request_id: partRequest.id,
                    estado_anterior: estadoAnterior,
                    estado_nuevo: PartRequestStatus.LITIGIO,
                    actor_id: user.userId,
                    notas: pendingProduct
                        ? `${dto.motivo} (se eliminó la asignación previa a la orden #${pendingProduct.id})`
                        : dto.motivo,
                }),
            );

            const result = {
                id: partRequest.id,
                estado_pedido: partRequest.estado,
                arrival: partRequest.arrival ?? null,
                attachments,
                assignment_removed: !!pendingProduct,
            };

            if (attachments.length) {
                await enrichPartRequestAttachmentsWithSignedUrls([{ id: result.id, attachments }], this.awsS3Service);
            }

            return result;
        });
    }
    async listLitigios(
        dto: { page?: number; limit?: number; search?: string; providerId?: number; motivoCategoria?: string },
        user: { companyId: string },
    ) {
        const page = dto.page && dto.page > 0 ? dto.page : 1;
        const limit = dto.limit && dto.limit > 0 ? Math.min(dto.limit, 100) : 20;

        const qb = this.partRequestRepo
            .createQueryBuilder('pr')
            .leftJoinAndSelect('pr.sourcing', 'sourcing')
            .leftJoinAndSelect('sourcing.provider', 'provider')
            .leftJoinAndSelect('pr.order', 'order')
            .leftJoinAndSelect('pr.arrival', 'arrival')
            .leftJoinAndSelect('pr.technician', 'technician')
            .leftJoinAndSelect('pr.responsableBusqueda', 'responsableBusqueda')
            .where('pr.company_id = :companyId', { companyId: user.companyId })
            .andWhere('pr.estado = :estado', { estado: PartRequestStatus.LITIGIO });

        if (dto.providerId) {
            qb.andWhere('provider.id = :providerId', { providerId: dto.providerId });
        }

        if (dto.motivoCategoria) {
            qb.andWhere('arrival.motivo_categoria = :motivoCategoria', { motivoCategoria: dto.motivoCategoria });
        }

        if (dto.search?.trim()) {
            qb.andWhere(
                '(pr.descripcion ILIKE :search OR provider.nombre ILIKE :search)',
                { search: `%${dto.search.trim()}%` },
            );
        }

        const [partRequests, total] = await qb
            .orderBy('arrival.fecha_validacion', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();

        const data = partRequests.map((pr) => ({
            id: pr.id,
            order_id: pr.order_id,
            order_number: pr.order?.order_number ?? null,
            descripcion: pr.descripcion,
            marca: pr.marca,
            modelo: pr.modelo,
            provider: pr.sourcing?.provider
                ? { id: pr.sourcing.provider.id, nombre: pr.sourcing.provider.nombre }
                : null,
            technician: mapUser(pr.technician),
            responsableBusqueda: mapUser(pr.responsableBusqueda),
            motivo_categoria: pr.arrival?.motivo_categoria ?? null,
            motivo: pr.arrival?.motivo_rechazo ?? null,
            fecha_litigio: pr.arrival?.fecha_validacion ?? null,
            validado_por_id: pr.arrival?.validado_por_id ?? null,
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
                motivoCategoria: [
                    { value: 'PRODUCTO_INCORRECTO', label: 'Producto incorrecto' },
                    { value: 'CALIDAD_DEFICIENTE', label: 'Calidad deficiente' },
                    { value: 'DAÑADO_EN_TRANSITO', label: 'Dañado en tránsito' },
                    { value: 'CANTIDAD_INCOMPLETA', label: 'Cantidad incompleta' },
                    { value: 'OTRO', label: 'Otro' },
                ],
            },
        };
    }
}
