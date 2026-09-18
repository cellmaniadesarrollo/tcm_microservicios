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
import { enrichPartRequestAttachmentsWithSignedUrls } from './helpers/part-requests.helpers';

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

    async registrarLlegada(
        dto: RegistrarLlegadaDto,
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
                .leftJoinAndSelect('pr.arrival', 'arrival')
                .where('pr.id = :id', { id: dto.id })
                .andWhere('pr.company_id = :companyId', { companyId: user.companyId })
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

            // La asignación ya debió crearse al completar el pago. Si no existe, algo está mal en el flujo.
            const pendingProduct = await manager.findOne(OrderPendingProduct, {
                where: { part_request_id: partRequest.id },
            });

            if (!pendingProduct) {
                throw new RpcException(
                    new BadRequestException('No existe una asignación a la orden; el pago debe completarse antes de aprobar la llegada'),
                );
            }

            // Sanity check: no se puede aprobar si llegó menos de lo que ya se asignó a la orden
            if (partRequest.arrival.cantidad < pendingProduct.quantity) {
                throw new RpcException(
                    new BadRequestException(
                        `La cantidad llegada (${partRequest.arrival.cantidad}) es menor a la cantidad ya asignada a la orden (${pendingProduct.quantity})`,
                    ),
                );
            }

            const estadoAnterior = partRequest.estado;

            // 1. Marcar la validación como aprobada
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

            // 3. Solo cambia el estado — la asignación ya existe desde el pago
            partRequest.estado = PartRequestStatus.LLEGADO_ASIGNADO;
            partRequest.responsable_recepcion_id = user.userId;
            await manager.save(partRequest);

            // 4. Historial
            const history = manager.create(PartRequestStatusHistory, {
                part_request_id: partRequest.id,
                estado_anterior: estadoAnterior,
                estado_nuevo: PartRequestStatus.LLEGADO_ASIGNADO,
                actor_id: user.userId,
                notas: `Llegada aprobada (${partRequest.arrival.cantidad} unidades llegadas, ${pendingProduct.quantity} asignadas a la orden)`,
            });
            await manager.save(history);

            const arrivalWithAttachments = { ...partRequest.arrival, attachments };
            await enrichPartRequestAttachmentsWithSignedUrls([arrivalWithAttachments], this.awsS3Service);

            return {
                arrival: arrivalWithAttachments,
                pendingProduct,
                estado_pedido: partRequest.estado,
            };
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
                .addSelect(['order.id'])
                .leftJoinAndSelect('pr.arrival', 'arrival')
                .where('pr.id = :id', { id: dto.id })
                .andWhere('pr.company_id = :companyId', { companyId: user.companyId })
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

            // 0. Buscar asignación existente para esta solicitud (caso: re-validación tras una aprobación previa)
            const pendingProduct = await manager.findOne(OrderPendingProduct, {
                where: { part_request_id: partRequest.id },
            });

            if (pendingProduct?.is_in_inventory) {
                throw new RpcException(
                    new BadRequestException(
                        'No se puede rechazar: el repuesto asignado ya fue movido a inventario',
                    ),
                );
            }

            const estadoAnterior = partRequest.estado;

            // 1. Marcar la validación como rechazada
            partRequest.arrival.resultado_validacion = 'RECHAZADO';
            partRequest.arrival.validado_por_id = user.userId;
            partRequest.arrival.fecha_validacion = new Date();
            partRequest.arrival.motivo_rechazo = dto.motivoRechazo;
            await manager.save(partRequest.arrival);

            // 2. Eliminar la asignación previa a la orden, si existía
            if (pendingProduct) {
                await manager.softDelete(OrderPendingProduct, { id: pendingProduct.id });
            }

            // 3. Fotos de evidencia del rechazo
            const attachments: Attachment[] = [];
            for (const file of files) {
                const buffer = Buffer.from(file.buffer, 'base64');
                const prefix = `order/${partRequest.order_id}/part-requests/${partRequest.id}/arrival-rejection/`;
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

            // 4. Actualizar estado del pedido
            partRequest.estado = PartRequestStatus.LLEGADO_RECHAZADO;
            await manager.save(partRequest);

            // 5. Historial
            const history = manager.create(PartRequestStatusHistory, {
                part_request_id: partRequest.id,
                estado_anterior: estadoAnterior,
                estado_nuevo: PartRequestStatus.LLEGADO_RECHAZADO,
                actor_id: user.userId,
                notas: pendingProduct
                    ? `${dto.motivoRechazo} (se eliminó la asignación previa a la orden #${pendingProduct.id})`
                    : dto.motivoRechazo,
            });
            await manager.save(history);

            // 6. Notificación + broadcast (pendiente)
            // await this.notificationsService.emitNotification(...)
            // await this.broadcastService.publishOrderUpdated(...)

            const result = {
                ...partRequest.arrival,
                attachments,
                estado_pedido: partRequest.estado,
                assignment_removed: !!pendingProduct,
            };

            await enrichPartRequestAttachmentsWithSignedUrls([result], this.awsS3Service);

            return result;
        });
    }
}
