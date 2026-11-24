import { BadRequestException, Injectable } from '@nestjs/common';
import { MailConfigService, UpsertMailConfigInput } from './mail-config.service';
import { MAIL_PURPOSES, MAIL_PURPOSE_META, MailPurpose } from '../types/mail.types';
import { MAIL_TYPES } from '../mail-types/mail-types.registry';

export type SaveMailConfigPayload = Omit<UpsertMailConfigInput, 'companyId'>;

@Injectable()
export class MailConfigAdminService {
    constructor(private readonly mailConfig: MailConfigService) { }

    /** Catálogo que consume el frontend: propósitos habilitados + correos que usan cada uno. */
    listPurposes() {
        const types = Object.values(MAIL_TYPES);
        return MAIL_PURPOSES
            .filter((p) => MAIL_PURPOSE_META[p].enabled)
            .map((purpose) => ({
                purpose,
                label: MAIL_PURPOSE_META[purpose].label,
                description: MAIL_PURPOSE_META[purpose].description,
                emptyHint: MAIL_PURPOSE_META[purpose].emptyHint,
                mailTypes: types
                    .filter((t) => t.purpose === purpose)
                    .map((t) => ({ key: t.key, label: t.label })),
            }));
    }

    list(companyId: string) {
        return this.mailConfig.list(companyId);
    }

    remove(companyId: string, purpose: MailPurpose) {
        return this.mailConfig.remove(companyId, purpose);
    }

    async save(companyId: string, payload: SaveMailConfigPayload) {
        if (!MAIL_PURPOSES.includes(payload.purpose) || !MAIL_PURPOSE_META[payload.purpose].enabled) {
            throw new BadRequestException('Propósito inválido');
        }
        return this.mailConfig.upsert({ ...payload, companyId });
    }
}