import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, ILike, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { AwsS3Service } from '../aws-s3/aws-s3.service';
import { PartRequest } from './entities/part-request.entity';
import { Attachment, AttachmentEntityType } from '../order-findings/entities/attachment.entity';
import { PartRequestStatus, PartRequestType } from './entities/enums/part-request-status.enum';
import { PartRequestStatusHistory } from './entities/part-request-status-history.entity';
import { PartRequestSourcing } from './entities/part-request-sourcing.entity';
import { SourcingProviderAccount } from './entities/sourcing-provider-account.entity';
import { EncontradoNacionalDto } from './dto/encontrado-nacional.dto';
import { SearchProvidersDto } from './entities/search-providers.dto';
import { Provider } from './entities/provider.entity';
import { ProviderAccount } from './entities/provider-account.entity';
import { mapUser, enrichPartRequestAttachmentsWithSignedUrls } from './helpers/part-requests.helpers';

/**
 * Dueño de la etapa de búsqueda/cotización: registrar "encontrado nacional"
 * (que crea el sourcing y avanza a ESPERA_DE_PAGO) y la búsqueda de
 * proveedores + sus cuentas bancarias.
 */
@Injectable()
export class PartRequestSourcingService {
    constructor(
        @InjectRepository(PartRequest) private readonly partRequestRepo: Repository<PartRequest>,
        @InjectRepository(Provider) private readonly providerRepo: Repository<Provider>,
        private readonly awsS3Service: AwsS3Service,
    ) { }

    async search(dto: SearchProvidersDto, user: { companyId: string }) {
        const query = dto.query?.trim()?.toUpperCase();

        if (!query || query.length < 2) {
            return [];
        }

        const providers = await this.providerRepo.find({
            where: { nombre: ILike(`%${query}%`), company_id: user.companyId },
            relations: ['cuentas'],
            order: { nombre: 'ASC' },
            take: 10,
        });

        return providers.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            contacto: p.contacto,
            cuentas: (p.cuentas ?? [])
                .filter((c) => c.activa)
                .map((c) => ({
                    id: c.id,
                    alias: c.alias,
                    banco: c.banco,
                    numeroCuenta: c.numero_cuenta,
                    tipoCuenta: c.tipo_cuenta,
                    titularCuenta: c.titular_cuenta,
                })),
        }));
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
                .addSelect(['order.id'])
                .where('pr.id = :id', { id: dto.id })
                .andWhere('pr.company_id = :companyId', { companyId: user.companyId })
                .getOne();

            if (!partRequest) {
                throw new RpcException(new NotFoundException('Solicitud de repuesto no encontrada'));
            }

            if (partRequest.estado !== PartRequestStatus.SOLICITADO) {
                throw new RpcException(
                    new BadRequestException(
                        `No se puede registrar "encontrado nacional": la solicitud está en estado "${partRequest.estado}"`,
                    ),
                );
            }

            if (!dto.precio || dto.precio <= 0) {
                throw new RpcException(new BadRequestException('El precio debe ser mayor a 0'));
            }

            if (dto.precioVenta !== undefined && dto.precioVenta !== null && dto.precioVenta <= 0) {
                throw new RpcException(new BadRequestException('El precio de venta debe ser mayor a 0'));
            }

            const estadoAnterior = partRequest.estado; // SOLICITADO

            // 1. Actualizar el pedido: estado + autoasignación + tipo + precio_venta (si vino)
            partRequest.estado = PartRequestStatus.ESPERA_DE_PAGO;
            partRequest.tipo = PartRequestType.NACIONAL;
            partRequest.responsable_busqueda_id = user.userId;
            if (dto.precioVenta !== undefined && dto.precioVenta !== null) {
                partRequest.precio_venta = dto.precioVenta;
            }
            await manager.save(partRequest);

            // 2. Resolver proveedor + cuenta (find-or-create)
            const { providerId, providerAccountId } = await this.resolveProviderAndAccount(
                manager,
                dto,
                user.companyId,
            );

            // 3. Guardar/actualizar sourcing
            let sourcing = await manager.findOne(PartRequestSourcing, {
                where: { part_request_id: partRequest.id },
            });

            if (sourcing) {
                sourcing.provider_id = providerId;
                sourcing.precio = dto.precio;
                sourcing.precio_transporte = dto.precioTransporte ?? sourcing.precio_transporte ?? 0;
                sourcing.cantidad = dto.cantidad ?? sourcing.cantidad ?? 1;
                sourcing.contacto_proveedor = dto.contactoProveedor;
                sourcing.link_compra = dto.linkCompra;
                sourcing.notas = dto.notas;
                sourcing.registrado_por_id = user.userId;
            } else {
                sourcing = manager.create(PartRequestSourcing, {
                    part_request_id: partRequest.id,
                    provider_id: providerId,
                    precio: dto.precio,
                    precio_transporte: dto.precioTransporte ?? 0,
                    cantidad: dto.cantidad ?? 1,
                    contacto_proveedor: dto.contactoProveedor,
                    link_compra: dto.linkCompra,
                    notas: dto.notas,
                    registrado_por_id: user.userId,
                });
            }
            const savedSourcing = await manager.save(sourcing);

            // 4. Vincular la cuenta seleccionada/creada al sourcing (si hay una)
            if (providerAccountId) {
                const yaVinculada = await manager.findOne(SourcingProviderAccount, {
                    where: { sourcing_id: savedSourcing.id, provider_account_id: providerAccountId },
                });
                if (!yaVinculada) {
                    await manager.save(
                        manager.create(SourcingProviderAccount, {
                            sourcing_id: savedSourcing.id,
                            provider_account_id: providerAccountId,
                        }),
                    );
                }
            }

            // 5. Adjuntos (sin cambios)
            const attachments: Attachment[] = [];
            for (const file of files) {
                const buffer = Buffer.from(file.buffer, 'base64');
                const prefix = `order/${partRequest.order_id}/part-requests/${partRequest.id}/encontrado-nacional/`;
                const url = await this.awsS3Service.uploadBuffer(buffer, file.originalname, file.mimetype, prefix);

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

            // 6. Historial: SOLICITADO -> ESPERA_DE_PAGO directo
            const history = manager.create(PartRequestStatusHistory, {
                part_request_id: partRequest.id,
                estado_anterior: estadoAnterior,
                estado_nuevo: PartRequestStatus.ESPERA_DE_PAGO,
                actor_id: user.userId,
                notas: dto.notas,
            });
            await manager.save(history);

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
                sourcing: savedSourcing,
                attachments,
            };

            await enrichPartRequestAttachmentsWithSignedUrls([result], this.awsS3Service);

            return result;
        });
    }

    private async resolveProviderAndAccount(
        manager: EntityManager,
        dto: EncontradoNacionalDto,
        companyId: string,
    ): Promise<{ providerId: number; providerAccountId?: number }> {
        // ─── 1. Proveedor ───────────────────────────────────────────
        let providerId: number;

        if (dto.providerId) {
            const provider = await manager.findOne(Provider, {
                where: { id: dto.providerId, company_id: companyId },
            });
            if (!provider) {
                throw new RpcException(new NotFoundException('Proveedor no encontrado'));
            }
            providerId = provider.id;
        } else {
            if (!dto.proveedor?.trim()) {
                throw new RpcException(new BadRequestException('El proveedor es requerido'));
            }

            const nombreNormalizado = dto.proveedor.trim().toUpperCase();

            // Red de seguridad: si ya existe uno con ese nombre en la compañía, se reutiliza
            // en vez de crear un duplicado (por si el usuario no seleccionó del autocomplete).
            const existente = await manager
                .createQueryBuilder(Provider, 'p')
                .where('p.company_id = :companyId', { companyId })
                .andWhere('UPPER(p.nombre) = :nombre', { nombre: nombreNormalizado })
                .getOne();

            if (existente) {
                providerId = existente.id;
            } else {
                const nuevoProvider = manager.create(Provider, {
                    company_id: companyId,
                    nombre: nombreNormalizado,
                    contacto: dto.contactoProveedor,
                });
                const savedProvider = await manager.save(nuevoProvider);
                providerId = savedProvider.id;
            }
        }


        // ─── 2. Cuenta bancaria (opcional del todo si no se manda nada) ──
        let providerAccountId: number | undefined;

        if (dto.providerAccountId) {
            const account = await manager.findOne(ProviderAccount, {
                where: { id: dto.providerAccountId, provider_id: providerId },
            });
            if (!account) {
                throw new RpcException(
                    new NotFoundException('La cuenta bancaria no pertenece a este proveedor'),
                );
            }
            providerAccountId = account.id;
        } else if (dto.banco || dto.numeroCuenta || dto.tipoCuenta || dto.titularCuenta) {
            if (!dto.banco?.trim() || !dto.numeroCuenta?.trim() || !dto.tipoCuenta?.trim() || !dto.titularCuenta?.trim()) {
                throw new RpcException(
                    new BadRequestException(
                        'Si vas a registrar una cuenta nueva, banco, número de cuenta, tipo de cuenta y titular son obligatorios',
                    ),
                );
            }

            const nuevaCuenta = manager.create(ProviderAccount, {
                provider_id: providerId,
                banco: dto.banco.trim(),
                numero_cuenta: dto.numeroCuenta.trim(),
                tipo_cuenta: dto.tipoCuenta.trim(),
                titular_cuenta: dto.titularCuenta.trim(),
            });
            const savedCuenta = await manager.save(nuevaCuenta);
            providerAccountId = savedCuenta.id;
        }
        // Si no viene ni providerAccountId ni ningún campo bancario, se guarda sin cuenta (providerAccountId undefined)

        return { providerId, providerAccountId };
    }
}
