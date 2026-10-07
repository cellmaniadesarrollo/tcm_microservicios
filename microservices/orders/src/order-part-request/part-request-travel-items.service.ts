// microservices/orders/src/order-part-requests/part-request-travel-items.service.ts

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { PartRequest } from './entities/part-request.entity';
import { PartRequestStatusHistory } from './entities/part-request-status-history.entity';
import { PartRequestTravelItem } from './entities/part-request-travel-item.entity';
import { Provider } from './entities/provider.entity';
import { PartRequestStatus } from './entities/enums/part-request-status.enum';
import { TravelItemMode, TravelItemStatus } from './entities/enums/travel-item.enum';
import { AwsS3Service } from '../aws-s3/aws-s3.service';
import { Attachment, AttachmentEntityType } from '../order-findings/entities/attachment.entity';
import { formatPartRequestNumber } from './helpers/company-numbering.helper';
import { enrichPartRequestAttachmentsWithSignedUrls, mapUser } from './helpers/part-requests.helpers';
import { OrderPendingProduct } from '../order-extras/entities/order-pending-product.entity';
import { costoUnitarioViaje, precioParaOrden, resolverPrecioOrden } from './helpers/pricing.helper';

// Solo solicitudes recién creadas pueden pasar a búsqueda personal.
const STATES_ALLOWED_FOR_TRAVEL: PartRequestStatus[] = [
    PartRequestStatus.SOLICITADO,
];
// Estado al que pasa una solicitud vinculada cuando el viajero recoge el repuesto.
// ⚠️ Pon aquí el miembro de tu enum PartRequestStatus que corresponda.
const ESTADO_TRAS_RECOGIDO: PartRequestStatus = PartRequestStatus.LLEGADO_PENDIENTE_VALIDACION
/**
 * Dueño de la lista de viaje (búsqueda personal en Cuenca).
 * Paso 1: agregar una solicitud a la lista de búsqueda personal de la compañía.
 * No hay viajero asignado: quien compra o retira queda registrado al marcar el ítem.
 */
@Injectable()
export class PartRequestTravelItemsService {
    constructor(
        @InjectRepository(PartRequestTravelItem) private readonly travelItemRepo: Repository<PartRequestTravelItem>,
        @InjectRepository(PartRequest) private readonly partRequestRepo: Repository<PartRequest>,
        @InjectRepository(Provider) private readonly providerRepo: Repository<Provider>,
        @InjectRepository(Attachment) private readonly attachmentRepo: Repository<Attachment>,

        private readonly awsS3Service: AwsS3Service,
        private readonly dataSource: DataSource,
    ) { }


    async createTravelItem(
        dto: {
            partRequestId: number;
            mode: TravelItemMode;
            expectedQuantity?: number;
            suggestedProviderId?: number;
            officeNotes?: string;
            useRequestImages?: boolean;
        },
        files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>,
        user: { userId: string; companyId: string; branchId?: string },
    ) {
        // 1. Solicitud: debe existir y ser de la misma compañía
        const partRequest = await this.partRequestRepo.findOne({
            where: { id: dto.partRequestId, company_id: user.companyId },
        });
        if (!partRequest) {
            throw new RpcException(new NotFoundException('Solicitud de repuesto no encontrada'));
        }

        if (!STATES_ALLOWED_FOR_TRAVEL.includes(partRequest.estado)) {
            throw new RpcException(
                new BadRequestException(
                    `No se puede agregar a la lista de viaje una solicitud en estado ${partRequest.estado}`,
                ),
            );
        }

        // 2. Proveedor sugerido (opcional): misma compañía
        if (dto.suggestedProviderId) {
            const provider = await this.providerRepo.findOne({
                where: { id: dto.suggestedProviderId, company_id: user.companyId },
            });
            if (!provider) {
                throw new RpcException(new NotFoundException('Proveedor sugerido no encontrado'));
            }
        }

        // 3. Duplicado: ya está pendiente en alguna lista
        const existing = await this.travelItemRepo.findOne({
            where: { part_request_id: partRequest.id, status: TravelItemStatus.PENDIENTE },
        });
        if (existing) {
            throw new RpcException(
                new ConflictException('Esta solicitud ya está pendiente en una lista de viaje'),
            );
        }

        // 3.5 Subir imágenes nuevas a S3 ANTES de la transacción (no retener locks durante I/O)
        const uploaded: Array<{ name: string; url: string; type: string }> = [];
        for (const file of files) {
            const url = await this.awsS3Service.uploadBuffer(
                Buffer.from(file.buffer, 'base64'),
                file.originalname,
                file.mimetype,
                `part-requests/${partRequest.id}/travel-items/`,
            );
            uploaded.push({ name: file.originalname, url, type: file.mimetype });
        }

        // 4. Ítem + estado + historial + attachments, todo atómico
        try {
            return await this.dataSource.transaction(async (manager) => {
                const item = await manager.save(
                    manager.create(PartRequestTravelItem, {
                        company_id: user.companyId,
                        part_request_id: partRequest.id,
                        mode: dto.mode,
                        status: TravelItemStatus.PENDIENTE,
                        expected_quantity: dto.expectedQuantity ?? 1,
                        suggested_provider_id: dto.suggestedProviderId ?? null,
                        office_notes: dto.officeNotes ?? null,
                        assigned_by_id: user.userId,
                    }),
                );

                const estadoAnterior = partRequest.estado;

                // Update condicionado al estado leído: si otro proceso la movió, no se pisa.
                const updated = await manager.update(
                    PartRequest,
                    { id: partRequest.id, company_id: user.companyId, estado: estadoAnterior },
                    { estado: PartRequestStatus.EN_BUSQUEDA_PERSONAL },
                );
                if (!updated.affected) {
                    throw new RpcException(
                        new ConflictException('La solicitud cambió de estado, vuelve a intentarlo'),
                    );
                }

                await manager.save(
                    manager.create(PartRequestStatusHistory, {
                        part_request_id: partRequest.id,
                        estado_anterior: estadoAnterior,
                        estado_nuevo: PartRequestStatus.EN_BUSQUEDA_PERSONAL,
                        actor_id: user.userId,
                        notas: 'Agregada a la lista de búsqueda personal',
                    }),
                );

                const attachments: Attachment[] = [];

                // 4a. Copiar imágenes de la solicitud (mismo file_url, fila nueva)
                if (dto.useRequestImages) {
                    const requestAtts = await manager.find(Attachment, {
                        where: {
                            entity_type: AttachmentEntityType.PART_REQUEST,
                            entity_id: partRequest.id,
                            is_active: true,
                        },
                    });

                    const copies = requestAtts.map((a) =>
                        manager.create(Attachment, {
                            entity_type: AttachmentEntityType.PART_REQUEST_TRAVEL_ITEM,
                            entity_id: item.id,
                            file_name: a.file_name,
                            file_url: a.file_url,
                            file_type: a.file_type,
                            uploaded_by_id: user.userId,
                            is_public: a.is_public,
                        }),
                    );
                    attachments.push(...(await manager.save(copies)));
                }

                // 4b. Imágenes nuevas subidas por la oficina
                for (const u of uploaded) {
                    attachments.push(
                        await manager.save(
                            manager.create(Attachment, {
                                entity_type: AttachmentEntityType.PART_REQUEST_TRAVEL_ITEM,
                                entity_id: item.id,
                                file_name: u.name,
                                file_url: u.url,
                                file_type: u.type,
                                uploaded_by_id: user.userId,
                                is_public: true,
                            }),
                        ),
                    );
                }

                return { ...item, attachments };
            });
        } catch (error: any) {
            // Carrera: el índice único parcial atrapó un duplicado simultáneo
            if (error?.code === '23505') {
                throw new RpcException(
                    new ConflictException('Esta solicitud ya está pendiente en una lista de viaje'),
                );
            }
            throw error;
        }
    }

    /**
     * Lista paginada de ítems de viaje de la compañía.
     * Por defecto devuelve solo los PENDIENTE (la lista de compras activa).
     */
    async listTravelItems(
        query: {
            page?: number | string;
            limit?: number | string;
            status?: TravelItemStatus;
            mode?: TravelItemMode;
            search?: string;
            linked?: 'true' | 'false'; // opcional: filtrar con/sin solicitud
        },
        user: { userId: string; companyId: string },
    ) {
        const page = Math.max(Number(query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
        const status = query.status ?? TravelItemStatus.PENDIENTE;

        const qb = this.travelItemRepo
            .createQueryBuilder('ti')
            .leftJoinAndSelect('ti.partRequest', 'pr')
            .leftJoinAndSelect('pr.technician', 'tech')
            .leftJoinAndSelect('ti.suggestedProvider', 'sp')
            .where('ti.company_id = :companyId', { companyId: user.companyId })
            .andWhere('ti.status = :status', { status });

        if (query.mode) {
            qb.andWhere('ti.mode = :mode', { mode: query.mode });
        }

        if (query.linked === 'true') qb.andWhere('ti.part_request_id IS NOT NULL');
        if (query.linked === 'false') qb.andWhere('ti.part_request_id IS NULL');

        const text = query.search?.trim();
        if (text) {
            const numeroMatch = text.match(/^(?:SR-?)?0*(\d+)$/i);
            qb.andWhere(
                new Brackets((b) => {
                    b.where('pr.descripcion ILIKE :s', { s: `%${text}%` })
                        .orWhere('pr.marca ILIKE :s')
                        .orWhere('pr.modelo ILIKE :s')
                        // campos propios del ítem standalone
                        .orWhere('ti.descripcion ILIKE :s')
                        .orWhere('ti.marca ILIKE :s')
                        .orWhere('ti.modelo ILIKE :s');
                    if (numeroMatch) {
                        b.orWhere('pr.numero = :numero', { numero: Number(numeroMatch[1]) });
                    }
                }),
            );
        }

        qb.orderBy('ti.createdAt', 'ASC')
            .skip((page - 1) * limit)
            .take(limit);

        const [items, total] = await qb.getManyAndCount();

        // Una sola query para todas las imágenes de la página
        const itemIds = items.map((i) => i.id);
        const attachments = itemIds.length
            ? await this.attachmentRepo.find({
                where: {
                    entity_type: AttachmentEntityType.PART_REQUEST_TRAVEL_ITEM,
                    entity_id: In(itemIds),
                    is_active: true,
                },
                order: { id: 'ASC' },
            })
            : [];

        const attsByItem = new Map<number, Attachment[]>();
        for (const a of attachments) {
            const list = attsByItem.get(a.entity_id) ?? [];
            list.push(a);
            attsByItem.set(a.entity_id, list);
        }
        // Firmar las URLs de todas las imágenes de la página en una sola pasada
        const toSign = items
            .filter((i) => (attsByItem.get(i.id)?.length ?? 0) > 0)
            .map((i) => ({ id: i.id, attachments: attsByItem.get(i.id)! }));
        if (toSign.length) {
            await enrichPartRequestAttachmentsWithSignedUrls(toSign, this.awsS3Service);
        }
        const data = items.map((i) => {
            const pr = i.partRequest ?? null;
            return {
                id: i.id,
                status: i.status,
                mode: i.mode,
                expected_quantity: i.expected_quantity,
                office_notes: i.office_notes ?? null,
                assigned_by_id: i.assigned_by_id,
                suggested_provider: i.suggestedProvider
                    ? { id: i.suggestedProvider.id, nombre: i.suggestedProvider.nombre }
                    : null,
                collected_quantity: i.collected_quantity ?? null,
                paid_cost: i.paid_cost ?? null,
                traveler_notes: i.traveler_notes ?? null,
                collected_at: i.collected_at ?? null,
                collected_by_id: i.collected_by_id ?? null,
                created_at: i.createdAt,

                // Indica de dónde vienen los datos descriptivos
                is_linked: !!pr,

                // Datos descriptivos unificados: de la solicitud si existe, si no los propios del ítem
                descripcion: pr?.descripcion ?? i.descripcion ?? null,
                marca: pr?.marca ?? i.marca ?? null,
                modelo: pr?.modelo ?? i.modelo ?? null,
                modelo_tecnico: pr?.modelo_tecnico ?? i.modelo_tecnico ?? null,
                tipo: pr?.tipo ?? i.tipo ?? null,
                color: pr?.color ?? i.color ?? null,
                calidad: pr?.calidad ?? i.calidad ?? null,

                attachments: attsByItem.get(i.id) ?? [],

                // null cuando el ítem no viene de una solicitud
                part_request: pr
                    ? {
                        id: pr.id,
                        numero: pr.numero,
                        numero_formateado: formatPartRequestNumber(pr.numero),
                        order_id: pr.order_id,
                        estado: pr.estado,
                        technician: mapUser(pr.technician),
                    }
                    : null,
            };
        });

        return {
            data,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async createStandaloneTravelItem(
        dto: {
            descripcion: string;
            mode: TravelItemMode;
            marca?: string;
            modelo?: string;
            modeloTecnico?: string;
            tipo?: string;
            color?: string;
            calidad?: string;
            expectedQuantity?: number;
            suggestedProviderId?: number;
            officeNotes?: string;
        },
        files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>,
        user: { userId: string; companyId: string; branchId?: string },
    ) {
        // 1. Validaciones (el MS no confía en el gateway)
        const descripcion = dto.descripcion?.trim();
        if (!descripcion || descripcion.length < 10) {
            throw new RpcException(
                new BadRequestException('La descripción debe tener al menos 10 caracteres'),
            );
        }
        if (!Object.values(TravelItemMode).includes(dto.mode)) {
            throw new RpcException(new BadRequestException('Modo de viaje inválido'));
        }

        // 2. Proveedor sugerido (opcional): misma compañía
        if (dto.suggestedProviderId) {
            const provider = await this.providerRepo.findOne({
                where: { id: dto.suggestedProviderId, company_id: user.companyId },
            });
            if (!provider) {
                throw new RpcException(new NotFoundException('Proveedor sugerido no encontrado'));
            }
        }

        // 3. Subir imágenes a S3 ANTES de la transacción
        const uploaded: Array<{ name: string; url: string; type: string }> = [];
        for (const file of files) {
            const url = await this.awsS3Service.uploadBuffer(
                Buffer.from(file.buffer, 'base64'),
                file.originalname,
                file.mimetype,
                `travel-items/${user.companyId}/`,
            );
            uploaded.push({ name: file.originalname, url, type: file.mimetype });
        }

        // 4. Ítem + attachments, atómico. No hay solicitud: sin cambio de estado ni historial.
        return this.dataSource.transaction(async (manager) => {
            const item = await manager.save(
                manager.create(PartRequestTravelItem, {
                    company_id: user.companyId,
                    part_request_id: null,
                    descripcion,
                    marca: dto.marca?.trim() || null,
                    modelo: dto.modelo?.trim() || null,
                    modelo_tecnico: dto.modeloTecnico?.trim() || null,
                    tipo: dto.tipo?.trim() || null,
                    color: dto.color?.trim() || null,
                    calidad: dto.calidad?.trim() || null,
                    mode: dto.mode,
                    status: TravelItemStatus.PENDIENTE,
                    expected_quantity: dto.expectedQuantity ?? 1,
                    suggested_provider_id: dto.suggestedProviderId ?? null,
                    office_notes: dto.officeNotes?.trim() || null,
                    assigned_by_id: user.userId,
                }),
            );

            const attachments: Attachment[] = [];
            for (const u of uploaded) {
                attachments.push(
                    await manager.save(
                        manager.create(Attachment, {
                            entity_type: AttachmentEntityType.PART_REQUEST_TRAVEL_ITEM,
                            entity_id: item.id,
                            file_name: u.name,
                            file_url: u.url,
                            file_type: u.type,
                            uploaded_by_id: user.userId,
                            is_public: true,
                        }),
                    ),
                );
            }

            return { ...item, attachments };
        });
    }
    async getTravelItemFullData(
        id: number,
        user: { companyId: string; userGroups?: string[] },
    ) {
        const item = await this.travelItemRepo
            .createQueryBuilder('ti')
            .leftJoinAndSelect('ti.suggestedProvider', 'sp')
            .leftJoinAndSelect('ti.traveler', 'traveler')
            .leftJoinAndSelect('ti.partRequest', 'pr')
            .leftJoinAndSelect('pr.technician', 'technician')
            .leftJoinAndSelect('pr.order', 'order')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.device', 'device')
            .leftJoinAndSelect('device.model', 'model')
            .leftJoinAndSelect('model.brand', 'brand')
            .leftJoinAndSelect('device.imeis', 'imeis')
            .where('ti.id = :id', { id })
            .andWhere('ti.company_id = :companyId', { companyId: user.companyId })
            .getOne();

        if (!item) {
            throw new RpcException(new NotFoundException('Ítem de viaje no encontrado'));
        }

        const puedeVerPagos =
            user.userGroups?.some((g) =>
                ['ORDER_AUDIT', 'LOGISTICA_REPUESTOS', 'COMPANY_ADMIN', 'ADMINS'].includes(g),
            ) ?? false;

        // Imágenes propias del ítem (si vino de una solicitud, se copiaron al crearlo)
        const attachments = await this.attachmentRepo.find({
            where: {
                entity_type: AttachmentEntityType.PART_REQUEST_TRAVEL_ITEM,
                entity_id: item.id,
                is_active: true,
            },
            order: { createdAt: 'ASC' },
        });

        // Firmar solo imágenes; los links (text/uri-list) quedan tal cual
        const imagenes = attachments.filter((a) => a.file_type?.startsWith('image/'));
        if (imagenes.length) {
            await enrichPartRequestAttachmentsWithSignedUrls(
                [{ id: item.id, attachments: imagenes }],
                this.awsS3Service,
            );
        }
        const resultAttachments = await this.attachmentRepo.find({
            where: {
                entity_type: AttachmentEntityType.PART_REQUEST_TRAVEL_ITEM_RESULT,
                entity_id: item.id,
                is_active: true,
            },
            order: { createdAt: 'ASC' },
        });

        const resultImages = resultAttachments.filter((a) => a.file_type?.startsWith('image/'));
        if (resultImages.length) {
            await enrichPartRequestAttachmentsWithSignedUrls(
                [{ id: item.id, attachments: resultImages }],
                this.awsS3Service,
            );
        }
        const pr = item.partRequest ?? null;
        const order = pr?.order ?? null;

        return {
            id: item.id,
            status: item.status,
            mode: item.mode,
            expected_quantity: item.expected_quantity,
            office_notes: item.office_notes ?? null,
            assigned_by_id: item.assigned_by_id,
            suggested_provider: item.suggestedProvider
                ? { id: item.suggestedProvider.id, nombre: item.suggestedProvider.nombre }
                : null,

            // Lo que llena el viajero
            collected_quantity: item.collected_quantity ?? null,
            paid_cost: puedeVerPagos && item.paid_cost != null ? Number(item.paid_cost) : null,
            traveler_notes: item.traveler_notes ?? null,
            collected_at: item.collected_at ?? null,
            collected_by_id: item.collected_by_id ?? null,
            traveler: item.traveler ? mapUser(item.traveler) : null,

            created_at: item.createdAt,
            updated_at: item.updatedAt,

            is_linked: !!pr,

            // Datos descriptivos unificados (de la solicitud o propios del ítem)
            descripcion: pr?.descripcion ?? item.descripcion ?? null,
            marca: pr?.marca ?? item.marca ?? null,
            modelo: pr?.modelo ?? item.modelo ?? null,
            modelo_tecnico: pr?.modelo_tecnico ?? item.modelo_tecnico ?? null,
            tipo: pr?.tipo ?? item.tipo ?? null,
            color: pr?.color ?? item.color ?? null,
            calidad: pr?.calidad ?? item.calidad ?? null,

            attachments,

            // null en ítems sueltos
            part_request: pr
                ? {
                    id: pr.id,
                    numero: pr.numero ?? null,
                    numero_formateado: formatPartRequestNumber(pr.numero),
                    estado: pr.estado,
                    fecha_solicitud: pr.createdAt,
                    order_id: pr.order_id ?? null,
                    technician: mapUser(pr.technician),
                }
                : null,

            // null si es suelto o si la solicitud no tiene orden
            order: order
                ? {
                    id: order.id,
                    order_number: order.order_number,
                    public_id: order.public_id ?? null,
                    customer: order.customer
                        ? {
                            id: order.customer.id,
                            firstName: order.customer.firstName,
                            lastName: order.customer.lastName,
                            idNumber: order.customer.idNumber,
                        }
                        : null,
                    device: order.device
                        ? {
                            device_id: order.device.device_id,
                            serial_number: order.device.serial_number ?? null,
                            color: order.device.color ?? null,
                            storage: order.device.storage ?? null,
                            model: order.device.model
                                ? {
                                    models_name: order.device.model.models_name,
                                    brand: order.device.model.brand
                                        ? { brands_name: order.device.model.brand.brands_name }
                                        : null,
                                }
                                : null,
                            imeis: (order.device.imeis ?? []).map((i) => i.imei_number),
                        }
                        : null,
                }
                : null,
        };
    }

    async resolveTravelItem(
        id: number,
        dto: {
            result: 'RECOGIDO' | 'NO_ENCONTRADO';
            collectedQuantity?: number;
            paidCost?: number;
            travelerNotes?: string;
        },
        files: Array<{ buffer: string; originalname: string; mimetype: string; size: number }>,
        user: { userId: string; companyId: string; branchId?: string },
    ) {
        // 1. El ítem debe existir, ser de la compañía y seguir pendiente
        const item = await this.travelItemRepo.findOne({
            where: { id, company_id: user.companyId },
        });
        if (!item) {
            throw new RpcException(new NotFoundException('Ítem de viaje no encontrado'));
        }
        if (item.status !== TravelItemStatus.PENDIENTE) {
            throw new RpcException(
                new ConflictException(`El ítem ya fue resuelto (estado ${item.status})`),
            );
        }

        // 2. Reglas por resultado
        const notes = dto.travelerNotes?.trim() || null;
        let collectedQuantity: number | null = null;
        let paidCost: number | null = null;

        if (dto.result === 'RECOGIDO') {
            if (!dto.collectedQuantity || dto.collectedQuantity < 1) {
                throw new RpcException(new BadRequestException('Indica la cantidad recogida'));
            }
            collectedQuantity = dto.collectedQuantity;

            if (dto.paidCost !== undefined && dto.paidCost !== null) {
                if (typeof dto.paidCost !== 'number' || isNaN(dto.paidCost) || dto.paidCost < 0) {
                    throw new RpcException(new BadRequestException('El costo pagado no es válido'));
                }
                paidCost = Number(dto.paidCost.toFixed(2));
            }
            // En compra en efectivo el costo es obligatorio; en retiro ya estaba pagado
            if (item.mode === TravelItemMode.BUY_CASH && paidCost === null) {
                throw new RpcException(
                    new BadRequestException('Indica el costo pagado de la compra en efectivo'),
                );
            }
        } else if (dto.result === 'NO_ENCONTRADO') {
            if (!notes) {
                throw new RpcException(
                    new BadRequestException('Explica por qué no se encontró el repuesto'),
                );
            }
        } else {
            throw new RpcException(new BadRequestException('Resultado inválido'));
        }

        const newStatus =
            dto.result === 'RECOGIDO' ? TravelItemStatus.RECOGIDO : TravelItemStatus.NO_ENCONTRADO;

        // 2b. Si se recoge y la solicitud va a una orden, validar precio ANTES de subir fotos
        if (dto.result === 'RECOGIDO' && item.part_request_id) {
            const linkedPr = await this.partRequestRepo.findOne({
                where: { id: item.part_request_id, company_id: user.companyId },
            });

            if (linkedPr?.order_id) {
                const { precio: precioOrden, esAcordado } = resolverPrecioOrden(linkedPr);

                if (!precioOrden || precioOrden <= 0) {
                    throw new RpcException(
                        new BadRequestException(
                            'La solicitud vinculada no tiene precio de venta ni precio acordado',
                        ),
                    );
                }

                // Solo el precio de venta debe cubrir el costo; el acordado puede ser menor
                if (!esAcordado) {
                    const costoUnit = costoUnitarioViaje(collectedQuantity!, paidCost);
                    if (costoUnit !== null && precioOrden < costoUnit) {
                        throw new RpcException(
                            new BadRequestException(
                                `El precio de venta ($${precioOrden}) no puede ser menor al costo de compra por unidad ($${costoUnit})`,
                            ),
                        );
                    }
                }
            }
        }

        // 3. Subir fotos ANTES de la transacción
        const uploaded: Array<{ name: string; url: string; type: string }> = [];
        for (const file of files) {
            const url = await this.awsS3Service.uploadBuffer(
                Buffer.from(file.buffer, 'base64'),
                file.originalname,
                file.mimetype,
                `travel-items/${user.companyId}/${item.id}/result/`,
            );
            uploaded.push({ name: file.originalname, url, type: file.mimetype });
        }

        // 4. Ítem + (solicitud) + orden + historial + attachments, todo atómico
        return this.dataSource.transaction(async (manager) => {
            // Update condicionado: si otro proceso lo resolvió, no se pisa
            const updated = await manager.update(
                PartRequestTravelItem,
                { id: item.id, company_id: user.companyId, status: TravelItemStatus.PENDIENTE },
                {
                    status: newStatus,
                    collected_quantity: collectedQuantity,
                    paid_cost: paidCost,
                    traveler_notes: notes,
                    collected_at: new Date(),
                    collected_by_id: user.userId,
                },
            );
            if (!updated.affected) {
                throw new RpcException(
                    new ConflictException('El ítem cambió de estado, vuelve a intentarlo'),
                );
            }

            // 4a. Si está vinculado a una solicitud, moverla de estado y asignar a la orden
            if (item.part_request_id) {
                const pr = await manager.findOne(PartRequest, {
                    where: { id: item.part_request_id, company_id: user.companyId },
                });

                if (pr && pr.estado === PartRequestStatus.EN_BUSQUEDA_PERSONAL) {
                    let nuevoEstado: PartRequestStatus;
                    let nota: string;

                    if (dto.result === 'RECOGIDO') {
                        nuevoEstado = ESTADO_TRAS_RECOGIDO;
                        nota = 'Repuesto recogido por el viajero';
                    } else {
                        // Volver al estado en que estaba antes de entrar a búsqueda personal
                        const entrada = await manager.findOne(PartRequestStatusHistory, {
                            where: {
                                part_request_id: pr.id,
                                estado_nuevo: PartRequestStatus.EN_BUSQUEDA_PERSONAL,
                            },
                            order: { fecha: 'DESC' },
                        });
                        nuevoEstado = entrada?.estado_anterior ?? PartRequestStatus.SOLICITADO;
                        nota = 'No encontrado en búsqueda personal';
                    }

                    const moved = await manager.update(
                        PartRequest,
                        { id: pr.id, company_id: user.companyId, estado: PartRequestStatus.EN_BUSQUEDA_PERSONAL },
                        { estado: nuevoEstado },
                    );
                    if (!moved.affected) {
                        throw new RpcException(
                            new ConflictException('La solicitud cambió de estado, vuelve a intentarlo'),
                        );
                    }

                    await manager.save(
                        manager.create(PartRequestStatusHistory, {
                            part_request_id: pr.id,
                            estado_anterior: PartRequestStatus.EN_BUSQUEDA_PERSONAL,
                            estado_nuevo: nuevoEstado,
                            actor_id: user.userId,
                            notas: notes ? `${nota}: ${notes}` : nota,
                        }),
                    );
                }

                // 4a'. Asignar a la orden (misma lógica que en pagos)
                if (dto.result === 'RECOGIDO' && pr?.order_id) {
                    // Evita duplicar si ya se asignó por otra vía
                    const yaAsignado = await manager.findOne(OrderPendingProduct, {
                        where: { part_request_id: pr.id, order_id: pr.order_id },
                    });

                    if (!yaAsignado) {
                        await manager.save(
                            manager.create(OrderPendingProduct, {
                                order_id: pr.order_id,
                                company_id: user.companyId,
                                name_items: pr.descripcion,
                                sale_price: precioParaOrden(pr),
                                purchase_price: costoUnitarioViaje(collectedQuantity!, paidCost),
                                quantity: collectedQuantity!,
                                is_in_inventory: false,
                                created_by_id: user.userId,
                                part_request_id: pr.id,
                                extra_data: {
                                    origen: 'TRAVEL_ITEM',
                                    travel_item_id: item.id,
                                    cantidad_esperada: item.expected_quantity,
                                    cantidad_recogida: collectedQuantity,
                                },
                            }),
                        );
                    }
                }
            }

            // 4b. Fotos del viajero
            const attachments: Attachment[] = [];
            for (const u of uploaded) {
                attachments.push(
                    await manager.save(
                        manager.create(Attachment, {
                            entity_type: AttachmentEntityType.PART_REQUEST_TRAVEL_ITEM_RESULT,
                            entity_id: item.id,
                            file_name: u.name,
                            file_url: u.url,
                            file_type: u.type,
                            uploaded_by_id: user.userId,
                            is_public: true,
                        }),
                    ),
                );
            }

            const resolved = await manager.findOneOrFail(PartRequestTravelItem, { where: { id: item.id } });
            return { ...resolved, result_attachments: attachments };
        });
    }
}