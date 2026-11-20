import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';
import { MailConfigService } from './mail-config.service';
import { MailTransportFactory } from './mail-transport.factory';
import { MAIL_TYPES, MailPayloads, MailTypeKey } from '../mail-types/mail-types.registry';
import { MailConfigMissingError, MailSendError, MailType, SendMailResult } from '../types/mail.types';

export interface SendMailParams<K extends MailTypeKey> {
    companyId: string;
    type: K;
    to: string;
    payload: MailPayloads[K];
}

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    constructor(
        private readonly configs: MailConfigService,
        private readonly transports: MailTransportFactory,
        @InjectRepository(CompanyReplica) private readonly companyRepo: Repository<CompanyReplica>,
    ) { }

    /**
     * Envía un email de un tipo de negocio a nombre de una empresa.
     * Lanza MailConfigMissingError o MailSendError; el log lo lleva quien llama.
     */
    async send<K extends MailTypeKey>(params: SendMailParams<K>): Promise<SendMailResult> {
        const { companyId, type, to, payload } = params;

        const mailType = MAIL_TYPES[type] as MailType<MailPayloads[K]>;
        const cfg = await this.configs.getResolved(companyId, mailType.purpose);

        const company = await this.companyRepo.findOne({ where: { id: companyId } });
        const brand = { companyId, name: company?.name ?? cfg.fromName };

        const content = await mailType.build(payload, brand);

        try {
            const info = await this.transports.get(cfg).sendMail({
                from: { name: cfg.fromName, address: cfg.fromEmail },
                replyTo: cfg.replyTo ?? undefined,
                to,
                subject: content.subject,
                html: content.html,
                text: content.text,
                attachments: content.attachments,
            });
            return {
                messageId: info.messageId,
                accepted: (info.accepted ?? []).map(String),
                rejected: (info.rejected ?? []).map(String),
            };
        } catch (e: any) {
            const err = new MailSendError(e);
            if (err.permanent) await this.configs.recordError(cfg.id, err.message);
            throw err;
        }
    }
}

export { MailConfigMissingError };