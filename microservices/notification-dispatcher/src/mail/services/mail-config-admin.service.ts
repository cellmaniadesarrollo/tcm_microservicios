import { BadRequestException, Injectable } from '@nestjs/common';
import { MailConfigService, UpsertMailConfigInput } from './mail-config.service';
import { MailPurpose, MAIL_PURPOSES } from '../types/mail.types';

export type SaveMailConfigPayload = Omit<UpsertMailConfigInput, 'companyId'>;

@Injectable()
export class MailConfigAdminService {
    constructor(private readonly mailConfig: MailConfigService) { }

    list(companyId: string) {
        return this.mailConfig.list(companyId);
    }

    remove(companyId: string, purpose: MailPurpose) {
        return this.mailConfig.remove(companyId, purpose);
    }

    async save(companyId: string, payload: SaveMailConfigPayload) {
        if (!MAIL_PURPOSES.includes(payload.purpose)) {
            throw new BadRequestException('Propósito inválido');
        }

        return this.mailConfig.upsert({
            companyId,
            purpose: payload.purpose,
            provider: payload.provider,
            host: payload.host,
            port: payload.port,
            secure: payload.secure,
            username: payload.username,
            password: payload.password,
            fromEmail: payload.fromEmail,
            fromName: payload.fromName,
            replyTo: payload.replyTo,
            isActive: payload.isActive,
        });
    }
}