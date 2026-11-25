import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog } from './entities/notification-log.entity';
import { MailService } from '../mail/services/mail.service';

const APPROVAL_MINUTES = 5;
const DEFAULT_AUTHORIZE_PATH = '/customer-authorize';

export interface SendAuthorizationMailInput {
    companyId: string;
    authorizationId: string;
    token: string;
    requesterName: string;
    recipients: { id: string; email: string; name: string }[];
}

@Injectable()
export class AuthorizationMailService {
    private readonly logger = new Logger(AuthorizationMailService.name);

    constructor(
        @InjectRepository(NotificationLog) private readonly logRepo: Repository<NotificationLog>,
        private readonly mail: MailService,
    ) { }

    async sendAll(input: SendAuthorizationMailInput) {
        const approveUrl = this.buildApproveUrl(input.token);

        // En paralelo: es un envío urgente (vence en 5 min), no una campaña
        const results = await Promise.all(
            input.recipients.map((r) => this.sendOne(input, r, approveUrl)),
        );

        return {
            sent: results.filter((r) => r.status === 'SENT').length,
            failed: results.filter((r) => r.status === 'FAILED').length,
            results,
        };
    }

    /**
     * Arma el enlace de aprobación:
     *   FRONTEND_URL (solo origen) + CUSTOMER_AUTHORIZE_PATH + #token=...
     * El token va en el fragmento (#): no llega a logs de servidor ni a proxies.
     */
    private buildApproveUrl(token: string): string {
        const base = process.env.FRONTEND_URL;
        if (!base) throw new RpcException('FRONTEND_URL no configurada');

        const rawPath = process.env.CUSTOMER_AUTHORIZE_PATH ?? DEFAULT_AUTHORIZE_PATH;
        const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

        return `${base.replace(/\/+$/, '')}${path}#token=${encodeURIComponent(token)}`;
    }

    private async sendOne(
        input: SendAuthorizationMailInput,
        r: { id: string; email: string; name: string },
        approveUrl: string,
    ) {
        let log: NotificationLog;
        try {
            log = await this.logRepo.save(this.logRepo.create({
                type: 'CUSTOMER_AUTHORIZATION',
                channel: 'EMAIL',
                recipient: r.email,
                status: 'PENDING',
                // Nunca guardar el token ni el enlace en el log
                message: `Autorización ${input.authorizationId} solicitada por ${input.requesterName}`,
                dedupeKey: `custauth:${input.authorizationId}:${r.id}`, // ≤ 100 chars
            }));
        } catch (e: any) {
            if (e?.code === '23505') return { email: r.email, status: 'SKIPPED' as const };
            throw e;
        }

        try {
            await this.mail.send({
                companyId: input.companyId,
                type: 'CUSTOMER_AUTHORIZATION',
                to: r.email,
                payload: {
                    recipientName: r.name,
                    requesterName: input.requesterName,
                    approveUrl,
                    expiresInMinutes: APPROVAL_MINUTES,
                },
            });
            await this.logRepo.update(log.id, { status: 'SENT', sentAt: new Date() });
            return { email: r.email, status: 'SENT' as const };
        } catch (e: any) {
            await this.logRepo.update(log.id, {
                status: 'FAILED',
                errorMessage: e?.message ?? 'Error desconocido',
            });
            this.logger.error(`Fallo enviando autorización a ${r.email}: ${e?.message}`);
            return { email: r.email, status: 'FAILED' as const };
        }
    }
}