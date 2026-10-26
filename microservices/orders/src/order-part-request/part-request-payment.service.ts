import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
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
import { formatPartRequestNumber } from './helpers/company-numbering.helper';
import { precioParaOrden, resolverPrecioOrden } from './helpers/pricing.helper';
import { UserEmployeeCache } from '../users-employees-events/entities/user_employee_cache.entity';

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
            providerId?: number;
            llegada?: 'con_llegada' | 'sin_llegada';
            revision?: 'por_revisar' | 'revisadas';
        },
        user: { companyId: string },
    ) {
        const page = dto.page && dto.page > 0 ? dto.page : 1;
        const limit = dto.limit && dto.limit > 0 ? Math.min(dto.limit, 100) : 20;
        const filtro = dto.filtro ?? 'todos';

        const searchTerm = dto.search?.trim();
        const orderNumberMatch = searchTerm?.match(/^#(\d+)$/);
        const orderNumberValue = orderNumberMatch ? parseInt(orderNumberMatch[1], 10) : null;

        const requestNumberMatch = !orderNumberMatch ? searchTerm?.match(/^(?:SR-?)?(\d{1,9})$/i) : null;
        const numeroBuscado = requestNumberMatch ? parseInt(requestNumberMatch[1], 10) : null;
        const numeroConPrefijo = !!searchTerm && /^SR/i.test(searchTerm);

        const escapar = (s: string) => s.replace(/[\\%_]/g, '\\$&');
        const tokens = searchTerm ? searchTerm.split(/\s+/).filter(Boolean) : [];

        const filtrosResponse = {
            opciones: [
                { value: 'todos', label: 'Todos' },
                { value: 'pendientes', label: 'Pendientes de pago' },
                { value: 'pagados', label: 'Pagados' },
            ],
            opcionesLlegada: [
                { value: 'con_llegada', label: 'Llegado asignado' },
                { value: 'sin_llegada', label: 'Sin llegada asignada' },
            ],
            opcionesRevision: [
                { value: 'por_revisar', label: 'Por revisar' },
                { value: 'revisadas', label: 'Revisadas' },
            ],
        };

        // ═══════════════════════════════════════════════════════════
        // HELPERS COMPARTIDOS
        // ═══════════════════════════════════════════════════════════

        // ¿el pago tiene alguna solicitud que cumpla la condición? (EXISTS para no recortar allocations)
        const existeSolicitud = (cond: string, conOrden = false) => {
            const sb = this.paymentRepo
                .createQueryBuilder('p2')
                .select('1')
                .innerJoin('p2.allocations', 'a2')
                .innerJoin('a2.partRequest', 'pr2');
            if (conOrden) sb.innerJoin('pr2.order', 'o2');
            return `EXISTS (${sb.where('p2.id = pago.id').andWhere(cond).getQuery()})`;
        };

        // ¿la solicitud pr2 tuvo LLEGADO_ASIGNADO alguna vez?
        const TUVO_LLEGADA = `EXISTS (
        SELECT 1 FROM part_request_status_history h
        WHERE h.part_request_id = pr2.id
          AND h.estado_nuevo = :estadoLlegado
    )`;

        // Búsqueda sobre PAGOS (alias: pago, provider)
        const aplicarBusquedaPagados = (q: SelectQueryBuilder<any>) => {
            if (orderNumberValue !== null) {
                q.andWhere(existeSolicitud('o2.order_number = :orderNumber', true), {
                    orderNumber: orderNumberValue,
                });
            } else if (numeroBuscado !== null && numeroConPrefijo) {
                q.andWhere(existeSolicitud('pr2.numero = :numeroBuscado'), { numeroBuscado });
            } else {
                tokens.forEach((tok, i) => {
                    const numeroSql =
                        numeroBuscado !== null
                            ? `OR ${existeSolicitud('pr2.numero = :numeroBuscado')}`
                            : '';
                    q.andWhere(
                        `(provider.nombre ILIKE :t${i}
                      OR pago.notas ILIKE :t${i}
                      OR ${existeSolicitud(
                            `(pr2.descripcion ILIKE :t${i}
                            OR pr2.marca ILIKE :t${i}
                            OR pr2.modelo ILIKE :t${i}
                            OR pr2.modelo_tecnico ILIKE :t${i})`,
                        )}
                      ${numeroSql})`,
                        {
                            [`t${i}`]: `%${escapar(tok)}%`,
                            ...(numeroBuscado !== null ? { numeroBuscado } : {}),
                        },
                    );
                });
            }
        };

        // Búsqueda sobre SOLICITUDES pendientes (alias: pr, order, provider)
        const aplicarBusquedaPendientes = (q: SelectQueryBuilder<any>) => {
            if (orderNumberValue !== null) {
                q.andWhere('order.order_number = :orderNumber', { orderNumber: orderNumberValue });
            } else if (numeroBuscado !== null && numeroConPrefijo) {
                q.andWhere('pr.numero = :numeroBuscado', { numeroBuscado });
            } else {
                tokens.forEach((tok, i) => {
                    const numeroSql = numeroBuscado !== null ? 'pr.numero = :numeroBuscado OR ' : '';
                    q.andWhere(
                        `(${numeroSql}pr.descripcion ILIKE :t${i}
                      OR pr.marca ILIKE :t${i}
                      OR pr.modelo ILIKE :t${i}
                      OR pr.modelo_tecnico ILIKE :t${i}
                      OR provider.nombre ILIKE :t${i})`,
                        {
                            [`t${i}`]: `%${escapar(tok)}%`,
                            ...(numeroBuscado !== null ? { numeroBuscado } : {}),
                        },
                    );
                });
            }
        };

        // ═══════════════════════════════════════════════════════════
        // CONTEOS DE LA BÚSQUEDA EN LAS OTRAS VISTAS
        // ═══════════════════════════════════════════════════════════
        let conteosBusqueda: {
            pendientes: number;
            pagados: number;
            pagados_con_llegada: number;
            pagados_sin_llegada: number;
        } | null = null;

        if (searchTerm) {
            const contarPagados = async (llegada?: 'con_llegada' | 'sin_llegada') => {
                const q = this.paymentRepo
                    .createQueryBuilder('pago')
                    .innerJoin('pago.provider', 'provider')
                    .where('provider.company_id = :companyId', { companyId: user.companyId });

                if (dto.providerId) {
                    q.andWhere('pago.provider_id = :providerId', { providerId: dto.providerId });
                }
                aplicarBusquedaPagados(q);

                if (llegada) {
                    const cond = llegada === 'con_llegada' ? TUVO_LLEGADA : `NOT ${TUVO_LLEGADA}`;
                    q.andWhere(existeSolicitud(cond), { estadoLlegado: PartRequestStatus.LLEGADO_ASIGNADO });
                }

                const raw = await q.select('COUNT(DISTINCT pago.id)', 'cnt').getRawOne();
                return Number(raw?.cnt ?? 0);
            };

            const contarPendientes = async () => {
                const q = this.partRequestRepo
                    .createQueryBuilder('pr')
                    .innerJoinAndSelect('pr.sourcing', 'sourcing')
                    .innerJoin('sourcing.provider', 'provider')
                    .leftJoin('pr.order', 'order')
                    .leftJoinAndSelect('pr.pagoAllocations', 'allocations')
                    .where('pr.company_id = :companyId', { companyId: user.companyId })
                    .andWhere('pr.estado != :cancelado', { cancelado: PartRequestStatus.CANCELADO });

                if (dto.providerId) q.andWhere('provider.id = :providerId', { providerId: dto.providerId });
                aplicarBusquedaPendientes(q);

                const rows = await q.getMany();
                return rows.filter((pr) => {
                    const precio =
                        Number(pr.sourcing?.precio ?? 0) * Number(pr.sourcing?.cantidad ?? 1) +
                        Number(pr.sourcing?.precio_transporte ?? 0);
                    const pagado = (pr.pagoAllocations ?? []).reduce(
                        (s, a) => s + Number(a.monto_asignado),
                        0,
                    );
                    return Number((precio - pagado).toFixed(2)) > 0;
                }).length;
            };

            const [pendientes, pagados, pagadosCon, pagadosSin] = await Promise.all([
                contarPendientes(),
                contarPagados(),
                contarPagados('con_llegada'),
                contarPagados('sin_llegada'),
            ]);

            conteosBusqueda = {
                pendientes,
                pagados,
                pagados_con_llegada: pagadosCon,
                pagados_sin_llegada: pagadosSin,
            };
        }

        // ═══════════════════════════════════════════════════════════
        // CASO 1: PAGADOS → listar por PAGO
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
                .leftJoinAndSelect('partRequest.revisadaPor', 'prRevisadaPor')
                .innerJoinAndSelect('pago.provider', 'provider')
                .where('provider.company_id = :companyId', { companyId: user.companyId });

            if (dto.providerId) {
                qb.andWhere('pago.provider_id = :providerId', { providerId: dto.providerId });
            }

            const aplicarFiltroLlegada = (q: SelectQueryBuilder<any>) => {
                if (!dto.llegada) return;
                const cond = dto.llegada === 'con_llegada' ? TUVO_LLEGADA : `NOT ${TUVO_LLEGADA}`;
                q.andWhere(existeSolicitud(cond), { estadoLlegado: PartRequestStatus.LLEGADO_ASIGNADO });
            };

            const aplicarFiltroRevision = (q: SelectQueryBuilder<any>) => {
                if (!dto.revision || dto.llegada !== 'con_llegada') return;
                const cond =
                    dto.revision === 'por_revisar'
                        ? `${TUVO_LLEGADA} AND pr2.revisada_at IS NULL`
                        : `${TUVO_LLEGADA} AND pr2.revisada_at IS NOT NULL`;
                q.andWhere(existeSolicitud(cond), { estadoLlegado: PartRequestStatus.LLEGADO_ASIGNADO });
            };

            aplicarBusquedaPagados(qb);
            aplicarFiltroLlegada(qb);
            aplicarFiltroRevision(qb);

            const totalQb = this.paymentRepo
                .createQueryBuilder('pago')
                .innerJoin('pago.provider', 'provider')
                .where('provider.company_id = :companyId', { companyId: user.companyId });

            if (dto.providerId) {
                totalQb.andWhere('pago.provider_id = :providerId', { providerId: dto.providerId });
            }
            aplicarBusquedaPagados(totalQb);
            aplicarFiltroLlegada(totalQb);
            aplicarFiltroRevision(totalQb);

            const totalRaw = await totalQb.select('COUNT(DISTINCT pago.id)', 'cnt').getRawOne();
            const total = Number(totalRaw?.cnt ?? 0);

            const payments = await qb
                .orderBy('pago.fecha_pago', 'DESC')
                .skip((page - 1) * limit)
                .take(limit)
                .getMany();

            // Contador de "por revisar" (ignora la búsqueda para que el badge sea estable)
            const porRevisarQb = this.paymentRepo
                .createQueryBuilder('pago')
                .innerJoin('pago.provider', 'provider')
                .innerJoin('pago.allocations', 'al')
                .innerJoin('al.partRequest', 'prc')
                .where('provider.company_id = :companyId', { companyId: user.companyId })
                .andWhere(
                    `EXISTS (SELECT 1 FROM part_request_status_history hh
                         WHERE hh.part_request_id = prc.id AND hh.estado_nuevo = :estadoLlegado)`,
                    { estadoLlegado: PartRequestStatus.LLEGADO_ASIGNADO },
                )
                .andWhere('prc.revisada_at IS NULL');

            if (dto.providerId) {
                porRevisarQb.andWhere('pago.provider_id = :providerId', { providerId: dto.providerId });
            }
            const porRevisarRaw = await porRevisarQb.select('COUNT(DISTINCT prc.id)', 'cnt').getRawOne();
            const porRevisar = Number(porRevisarRaw?.cnt ?? 0);

            // Comprobantes
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

            // Solicitudes que alguna vez tuvieron LLEGADO_ASIGNADO
            const prIdsPagos = payments.flatMap((p) => (p.allocations ?? []).map((a) => a.part_request_id));
            const filasLlegada = prIdsPagos.length
                ? await this.partRequestRepo.manager
                    .createQueryBuilder(PartRequestStatusHistory, 'h')
                    .select('DISTINCT h.part_request_id', 'id')
                    .where('h.part_request_id IN (:...ids)', { ids: prIdsPagos })
                    .andWhere('h.estado_nuevo = :e', { e: PartRequestStatus.LLEGADO_ASIGNADO })
                    .getRawMany()
                : [];
            const tuvoLlegada = new Set<number>(filasLlegada.map((r) => Number(r.id)));

            const data = payments.map((p) => {
                const cubiertas = (p.allocations ?? []).filter((a) => {
                    const llegada = tuvoLlegada.has(a.part_request_id);
                    const revisada = !!a.partRequest?.revisada_at;

                    if (dto.llegada === 'con_llegada') {
                        if (!llegada) return false;
                        if (dto.revision === 'por_revisar') return !revisada;
                        if (dto.revision === 'revisadas') return revisada;
                        return true;
                    }
                    if (dto.llegada === 'sin_llegada') return !llegada;
                    return true;
                });

                return {
                    id: p.id,
                    monto: Number(p.monto),
                    fecha_pago: p.fecha_pago,
                    notas: p.notas ?? null,
                    cantidad_solicitudes_cubiertas: cubiertas.length,
                    tiene_comprobante: tieneComprobante.has(p.id),
                    provider: p.provider ? { id: p.provider.id, nombre: p.provider.nombre } : null,

                    solicitudes_cubiertas: cubiertas.map((a) => ({
                        id: a.part_request_id,
                        numero: a.partRequest?.numero ?? null,
                        numero_formateado: formatPartRequestNumber(a.partRequest?.numero),
                        order_id: a.partRequest?.order_id ?? null,
                        order_number: a.partRequest?.order?.order_number ?? null,
                        descripcion: a.partRequest?.descripcion ?? null,
                        marca: a.partRequest?.marca ?? null,
                        modelo: a.partRequest?.modelo ?? null,
                        modelo_tecnico: a.partRequest?.modelo_tecnico ?? null,
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

                        tuvo_llegada: tuvoLlegada.has(a.part_request_id),
                        revisada: !!a.partRequest?.revisada_at,
                        revisada_at: a.partRequest?.revisada_at ?? null,
                        revisada_por: mapUser(a.partRequest?.revisadaPor),
                    })),
                };
            });

            return {
                data,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit) || 0,
                },
                filtros: filtrosResponse,
                contadores: { por_revisar: porRevisar },
                conteos_busqueda: conteosBusqueda,
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

        aplicarBusquedaPendientes(qb);

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

        const filtered = enriched.filter((e) => {
            if (filtro === 'pendientes') return e.estadoPago !== 'PAGADO';
            return true;
        });

        // Fecha y responsable de la solicitud de pago
        const manager = this.partRequestRepo.manager;
        const prIds = filtered.map((e) => e.pr.id);

        const historiales = prIds.length
            ? await manager
                .createQueryBuilder(PartRequestStatusHistory, 'h')
                .where('h.part_request_id IN (:...prIds)', { prIds })
                .andWhere('h.estado_nuevo = :estado', { estado: PartRequestStatus.ESPERA_DE_PAGO })
                .orderBy('h.fecha', 'DESC')
                .getMany()
            : [];

        const solicitudPagoPorPr = new Map<number, PartRequestStatusHistory>();
        for (const h of historiales) {
            if (!solicitudPagoPorPr.has(h.part_request_id)) {
                solicitudPagoPorPr.set(h.part_request_id, h);
            }
        }

        const actorIds = [...new Set([...solicitudPagoPorPr.values()].map((h) => h.actor_id))];
        const actores = actorIds.length
            ? await manager.find(UserEmployeeCache, { where: { id: In(actorIds) } })
            : [];
        const actorPorId = new Map(actores.map((u) => [u.id, u]));

        const conSolicitudPago = filtered.map((e) => {
            const h = solicitudPagoPorPr.get(e.pr.id);
            return {
                ...e,
                fechaSolicitudPago: h?.fecha ?? null,
                solicitadoPor: h ? actorPorId.get(h.actor_id) : undefined,
            };
        });

        const ORDEN_FECHA_PAGO: 'ASC' | 'DESC' = 'DESC';
        const factor = ORDEN_FECHA_PAGO === 'DESC' ? -1 : 1;
        const cmpFecha = (a: Date | null, b: Date | null) => {
            if (!a && !b) return 0;
            if (!a) return 1;
            if (!b) return -1;
            return (a.getTime() - b.getTime()) * factor;
        };

        const porProveedor = new Map<
            number,
            {
                provider: { id: number; nombre: string };
                solicitudes: typeof conSolicitudPago;
                montoTotalPendiente: number;
            }
        >();

        for (const item of conSolicitudPago) {
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

        for (const g of porProveedor.values()) {
            g.solicitudes.sort((a, b) => cmpFecha(a.fechaSolicitudPago, b.fechaSolicitudPago));
        }

        const grupos = Array.from(porProveedor.values()).sort((a, b) => {
            const c = cmpFecha(
                a.solicitudes[0]?.fechaSolicitudPago ?? null,
                b.solicitudes[0]?.fechaSolicitudPago ?? null,
            );
            return c !== 0 ? c : b.montoTotalPendiente - a.montoTotalPendiente;
        });

        const total = grupos.length;
        const skip = (page - 1) * limit;
        const pageItems = grupos.slice(skip, skip + limit);

        const data = pageItems.map((g) => ({
            provider: g.provider,
            cantidadSolicitudes: g.solicitudes.length,
            montoTotalPendiente: Number(g.montoTotalPendiente.toFixed(2)),
            solicitudes: g.solicitudes.map(
                ({
                    pr,
                    montoProducto,
                    montoTransporte,
                    totalPagado,
                    saldoPendiente,
                    estadoPago,
                    fechaSolicitudPago,
                    solicitadoPor,
                }) => ({
                    id: pr.id,
                    numero: pr.numero ?? null,
                    numero_formateado: formatPartRequestNumber(pr.numero),
                    order_id: pr.order_id,
                    order_number: pr.order?.order_number ?? null,
                    fecha_solicitud: pr.createdAt,
                    fecha_solicitud_pago: fechaSolicitudPago,
                    solicitado_por: mapUser(solicitadoPor),
                    descripcion: pr.descripcion,
                    marca: pr.marca,
                    modelo: pr.modelo,
                    modelo_tecnico: pr.modelo_tecnico ?? null,
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
            filtros: filtrosResponse,
            conteos_busqueda: conteosBusqueda,
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
                        const { precio: precioOrden, esAcordado } = resolverPrecioOrden(pr);
                        const costoCompraNum = Number(pr.sourcing?.precio ?? 0);

                        if (!precioOrden || precioOrden <= 0) {
                            throw new RpcException(
                                new BadRequestException(
                                    `Debes indicar el precio de venta (o precio acordado) de la solicitud #${pr.id} antes de completar el pago`,
                                ),
                            );
                        }
                        // El precio acordado puede ser menor al costo (se asume la pérdida por cumplir al cliente).
                        // Solo el precio de venta debe cubrir el costo.
                        if (!esAcordado && precioOrden < costoCompraNum) {
                            throw new RpcException(
                                new BadRequestException(
                                    `El precio de venta de la solicitud #${pr.id} ($${precioOrden}) no puede ser menor al costo de compra ($${costoCompraNum})`,
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
                            sale_price: precioParaOrden(pr),
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
            numero: partRequest.numero ?? null,                                // <-- nuevo
            numero_formateado: formatPartRequestNumber(partRequest.numero),    // <-- nuevo
            estado: partRequest.estado,
            tipo: partRequest.tipo,
            marca: partRequest.marca,
            modelo: partRequest.modelo,
            descripcion: partRequest.descripcion,

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
                numero: pr?.numero ?? null,                                   // 👈 nuevo
                numero_formateado: pr?.numero != null                         // 👈 nuevo
                    ? `SR-${String(pr.numero).padStart(5, '0')}`
                    : null,
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
    async marcarRevisada(partRequestId: number, user: { userId: string; companyId: string }) {
        const pr = await this.partRequestRepo.findOne({
            where: { id: partRequestId, company_id: user.companyId },
        });

        if (!pr) {
            throw new RpcException({ status: 404, message: 'Solicitud no encontrada' });
        }
        if (pr.estado !== PartRequestStatus.LLEGADO_ASIGNADO) {
            throw new RpcException({
                status: 400,
                message: 'Solo se pueden marcar como revisadas las solicitudes en estado LLEGADO_ASIGNADO',
            });
        }
        if (pr.revisada_at) {
            throw new RpcException({ status: 409, message: 'La solicitud ya fue marcada como revisada' });
        }

        pr.revisada_at = new Date();
        pr.revisada_por_id = user.userId;
        await this.partRequestRepo.save(pr);

        const actor = await this.partRequestRepo.manager.findOne(UserEmployeeCache, {
            where: { id: user.userId },
        });

        return {
            id: pr.id,
            revisada: true,
            revisada_at: pr.revisada_at,
            revisada_por: mapUser(actor),
        };
    }
}