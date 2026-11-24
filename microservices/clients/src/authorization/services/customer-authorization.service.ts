import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { firstValueFrom, lastValueFrom, timeout } from 'rxjs';
import { EntityManager, In, LessThan, QueryFailedError, Repository } from 'typeorm';
import { APPROVAL_TTL_MS, USAGE_TTL_MS } from '../constants/constants';
import { AuthorizationStatus, CustomerAuthorization } from '../entities/customer-authorization.entity';
import { UsersEmployeesEventsService } from '../../users-employees-events/services/users-employees-events.service';

@Injectable()
export class CustomerAuthorizationService {
    private readonly logger = new Logger(CustomerAuthorizationService.name);

    constructor(
        @InjectRepository(CustomerAuthorization)
        private readonly repo: Repository<CustomerAuthorization>,
        private readonly users: UsersEmployeesEventsService,
        @Inject('NOTIFICATIONS_QUEUE') private readonly notifications: ClientProxy,
        @Inject('REALTIME_AUTH') private readonly realtime: ClientProxy,
    ) { }

    static hashToken(token: string) {
        return createHash('sha256').update(token).digest('hex');
    }

    // Marca como vencidas las del usuario (expiración perezosa)
    private async expireStale(userId: string) {
        const now = new Date();
        await this.repo.update(
            { requestedByUserId: userId, status: AuthorizationStatus.PENDING, expiresAt: LessThan(now) },
            { status: AuthorizationStatus.EXPIRED },
        );
        await this.repo.update(
            { requestedByUserId: userId, status: AuthorizationStatus.APPROVED, usableUntil: LessThan(now) },
            { status: AuthorizationStatus.EXPIRED },
        );
    }

    /**
     * Crea la solicitud. Devuelve el token en claro SOLO para uso interno
     * (paso 3: enviarlo a notificaciones). Nunca debe llegar al solicitante.
     */
    async request(user: any, ip?: string) {
        const userId = user?.sub ?? user?.id;
        const companyId = user?.companyId;
        if (!userId || !companyId) {
            throw new RpcException(new BadRequestException('Usuario o compañía no resueltos'));
        }

        await this.expireStale(userId);

        const active = await this.repo.findOne({
            where: {
                requestedByUserId: userId,
                status: In([AuthorizationStatus.PENDING, AuthorizationStatus.APPROVED]),
            },
        });
        if (active) {
            throw new RpcException(new ConflictException('Ya tienes una autorización activa'));
        }

        const recipients = await this.users.findAuthorizerRecipients(companyId, userId);
        if (!recipients.length) {
            throw new RpcException(new BadRequestException('No hay autorizadores disponibles'));
        }

        const token = randomBytes(32).toString('base64url');

        try {
            const saved = await this.repo.save(
                this.repo.create({
                    companyId,
                    requestedByUserId: userId,
                    requestedByUsername: user.username ?? null,
                    tokenHash: CustomerAuthorizationService.hashToken(token),
                    expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
                    requestIp: ip ?? null,
                }),
            );

            return {
                authorization: { id: saved.id, expiresAt: saved.expiresAt },
                token, // interno
                recipients: recipients.map((r) => ({
                    id: r.id,
                    email: r.email!,
                    name: r.firstName ?? r.username,
                })),
            };
        } catch (e) {
            // Doble clic simultáneo: lo frena el índice único parcial
            if (e instanceof QueryFailedError && (e as any).driverError?.code === '23505') {
                throw new RpcException(new ConflictException('Ya tienes una autorización activa'));
            }
            throw e;
        }
    }

    /** Envía el correo. Si nadie lo recibe, cancela la solicitud para no bloquear al usuario. */
    async notifyAuthorizers(params: {
        authorization: { id: string };
        token: string;
        recipients: { id: string; email: string; name: string }[];
        user: any;
    }) {
        const { authorization, token, recipients, user } = params;
        try {
            const res = await firstValueFrom(
                this.notifications
                    .send(
                        { cmd: 'send_customer_authorization_email' },
                        {
                            internalToken: process.env.INTERNAL_SECRET,
                            companyId: user.companyId,
                            authorizationId: authorization.id,
                            token,
                            requesterName: user.username,
                            recipients,
                        },
                    )
                    .pipe(timeout(10_000)),
            );
            if (!res?.sent) throw new Error('Ningún correo fue enviado');
        } catch (e) {
            // Se libera al usuario: el índice único permitirá pedir otra de inmediato
            await this.repo.update(
                { id: authorization.id, status: AuthorizationStatus.PENDING },
                { status: AuthorizationStatus.EXPIRED, expiresAt: new Date() },
            );
            throw new RpcException(
                new ServiceUnavailableException('No se pudo enviar el correo de autorización, intenta de nuevo'),
            );
        }
    }

    async approve(user: any, token: string, ip?: string) {
        const approverId = user?.sub;
        const companyId = user?.companyId;
        if (!approverId || !companyId || typeof token !== 'string' || !token) {
            throw new RpcException(new BadRequestException('Solicitud inválida'));
        }

        const auth = await this.repo.findOne({
            where: { tokenHash: CustomerAuthorizationService.hashToken(token) },
        });
        // Misma respuesta si no existe o es de otra compañía
        if (!auth || auth.companyId !== companyId) {
            throw new RpcException(new NotFoundException('Solicitud no encontrada'));
        }

        if (auth.requestedByUserId === approverId) {
            throw new RpcException(new ForbiddenException('No puedes aprobar tu propia solicitud'));
        }
        if (!(await this.users.isAuthorizer(approverId, companyId))) {
            throw new RpcException(new ForbiddenException('No tienes permiso para aprobar'));
        }

        const approver = await this.users.findById(approverId);
        const now = new Date();
        const usableUntil = new Date(now.getTime() + USAGE_TTL_MS);

        // Transición atómica: el primero que llega gana, el resto no afecta filas
        const res = await this.repo
            .createQueryBuilder()
            .update(CustomerAuthorization)
            .set({
                status: AuthorizationStatus.APPROVED,
                approvedAt: now,
                usableUntil,
                approvedByUserId: approverId,
                approvedByUsername: approver?.username ?? user.username ?? null,
                approveIp: ip ?? null,
            })
            .where('id = :id AND status = :pending AND expires_at > :now', {
                id: auth.id,
                pending: AuthorizationStatus.PENDING,
                now,
            })
            .execute();

        if (res.affected !== 1) {
            await this.expireStale(auth.requestedByUserId);
            const current = await this.repo.findOne({ where: { id: auth.id } });
            throw new RpcException(
                new ConflictException(
                    current?.status === AuthorizationStatus.APPROVED
                        ? 'Esta solicitud ya fue aprobada'
                        : 'La solicitud venció, el solicitante debe pedir otra',
                ),
            );
        }

        const approvedByName =
            [approver?.firstName, approver?.lastName].filter(Boolean).join(' ') ||
            approver?.username ||
            user.username ||
            'Autorizador';

        // El WebSocket es un aviso: si falla, la aprobación ya quedó guardada
        try {
            await lastValueFrom(
                this.realtime
                    .emit('customer.authorization.approved', {
                        authorizationId: auth.id,
                        companyId,
                        requestedByUserId: auth.requestedByUserId,
                        usableUntil,
                        approvedByName,
                    })
                    .pipe(timeout(3_000)),
                { defaultValue: null },
            );
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.error(`No se pudo emitir aprobación ${auth.id}: ${msg}`);
        }

        return { id: auth.id, status: AuthorizationStatus.APPROVED };
    }

    /** Respaldo del WebSocket: recarga de página o reconexión */
    async getActive(user: any) {
        const userId = user?.sub;
        if (!userId) return null;
        await this.expireStale(userId);
        const a = await this.repo.findOne({
            where: {
                requestedByUserId: userId,
                status: In([AuthorizationStatus.PENDING, AuthorizationStatus.APPROVED]),
            },
        });
        return a
            ? { id: a.id, status: a.status, expiresAt: a.expiresAt, usableUntil: a.usableUntil }
            : null;
    }

    /** Consume la autorización dentro de la transacción del llamador. */
    async consume(
        manager: EntityManager,
        p: { authorizationId: string; userId: string; companyId: string },
    ) {
        const now = new Date();
        const res = await manager
            .createQueryBuilder()
            .update(CustomerAuthorization)
            .set({ status: AuthorizationStatus.USED, usedAt: now })
            .where(
                `id = :id AND status = :approved AND requested_by_user_id = :uid
       AND company_id = :cid AND usable_until > :now`,
                { id: p.authorizationId, approved: AuthorizationStatus.APPROVED, uid: p.userId, cid: p.companyId, now },
            )
            .execute();

        if (res.affected === 1) return;

        // No se pudo consumir: se explica por qué sin filtrar datos de otros
        const a = await manager.findOne(CustomerAuthorization, { where: { id: p.authorizationId } });
        if (!a || a.companyId !== p.companyId || a.requestedByUserId !== p.userId) {
            throw new RpcException(new ForbiddenException('Autorización no válida'));
        }
        if (a.status === AuthorizationStatus.PENDING) {
            throw new RpcException(new ConflictException('La autorización aún no ha sido aprobada'));
        }
        if (a.status === AuthorizationStatus.USED) {
            throw new RpcException(new ConflictException('Esta autorización ya fue utilizada'));
        }
        throw new RpcException(new ConflictException('La autorización venció, solicita otra'));
    }

    async linkCustomer(manager: EntityManager, authorizationId: string, customerId: string) {
        await manager.update(CustomerAuthorization, { id: authorizationId }, { usedForCustomerId: customerId });
    }
}