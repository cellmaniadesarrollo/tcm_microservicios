// src/whatsapp/whatsapp-official.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappSession } from './entities/whatsapp-session.entity';
import { CompanyReplica } from '../companies/entities/company-replica.entity';

interface OfficialCredentialsDto {
    phoneNumberId: string;
    accessToken: string;
    wabaId: string;
    apiVersion?: string;
    routingId?: string | null;
}

@Injectable()
export class WhatsappOfficialService {
    private readonly logger = new Logger(WhatsappOfficialService.name);

    constructor(
        @InjectRepository(WhatsappSession)
        private readonly sessionRepo: Repository<WhatsappSession>,
        @InjectRepository(CompanyReplica)
        private readonly companyRepo: Repository<CompanyReplica>,
    ) { }

    /**
     * Crea o actualiza una sesión OFFICIAL. Valida el token contra Meta
     * ANTES de guardar, para no persistir credenciales inválidas.
     */
    async configureSession(
        companyId: string,
        dto: OfficialCredentialsDto,
        sessionId?: string,
    ): Promise<WhatsappSession> {
        const company = await this.companyRepo.findOne({ where: { id: companyId } });
        if (!company) throw new Error(`Empresa ${companyId} no encontrada`);

        const apiVersion = dto.apiVersion ?? 'v20.0';
        const phoneNumber = await this.verifyCredentials(dto.phoneNumberId, dto.accessToken, apiVersion);

        const existing = sessionId
            ? await this.sessionRepo.findOne({ where: { id: sessionId, companyId } })
            : null;

        if (sessionId && !existing) {
            throw new Error(`Sesión ${sessionId} no encontrada`);
        }

        const session = this.sessionRepo.create({
            ...(existing ?? {}),
            company,
            companyId,
            provider: 'OFFICIAL',
            routingId: dto.routingId ?? existing?.routingId ?? null,
            phoneNumberId: dto.phoneNumberId,
            accessToken: dto.accessToken,
            wabaId: dto.wabaId,
            apiVersion,
            phoneNumber,
            status: 'CONNECTED',
        });

        return this.sessionRepo.save(session);
    }

    /**
     * Llama a Meta para confirmar que el token y el phoneNumberId son válidos
     * y correlativos entre sí. Devuelve el número en formato E.164 sin '+'.
     */
    private async verifyCredentials(
        phoneNumberId: string,
        accessToken: string,
        apiVersion: string,
    ): Promise<string> {
        const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?fields=display_phone_number,verified_name`;

        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            this.logger.warn(`Verificación falló (${res.status}): ${body}`);
            throw new Error('No se pudo validar el token o el phoneNumberId con Meta');
        }

        const data = await res.json();
        return (data.display_phone_number as string)?.replace(/\D/g, '') ?? '';
    }

    async testConnection(sessionId: string, companyId: string): Promise<{ ok: boolean; phoneNumber: string }> {
        const session = await this.sessionRepo.findOne({ where: { id: sessionId, companyId } });
        if (!session || session.provider !== 'OFFICIAL') {
            throw new Error('Sesión oficial no encontrada');
        }
        const phoneNumber = await this.verifyCredentials(
            session.phoneNumberId!,
            session.accessToken!,
            session.apiVersion ?? 'v20.0',
        );
        return { ok: true, phoneNumber };
    }
    async sendTemplate(
        session: WhatsappSession,
        to: string,
        templateName: string,
        language: string,
        bodyParams: string[],
        buttonParams?: { index: number; text: string }[],   // 👈 nuevo
    ): Promise<void> {
        const apiVersion = session.apiVersion ?? 'v20.0';
        const url = `https://graph.facebook.com/${apiVersion}/${session.phoneNumberId}/messages`;

        const components: any[] = [];

        if (bodyParams.length) {
            components.push({
                type: 'body',
                parameters: bodyParams.map((text) => ({ type: 'text', text })),
            });
        }

        for (const btn of buttonParams ?? []) {
            components.push({
                type: 'button',
                sub_type: 'url',
                index: String(btn.index),
                parameters: [{ type: 'text', text: btn.text }],
            });
        }

        const payload = {
            messaging_product: 'whatsapp',
            to: this.toE164(to),
            type: 'template',
            template: { name: templateName, language: { code: language }, components },
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            this.logger.warn(`sendTemplate falló (${res.status}) para "${templateName}": ${body}`);
            throw new Error(`Meta rechazó el envío de plantilla "${templateName}" (${res.status})`);
        }
    }

    private toE164(phone: string): string {
        return phone.replace(/\D/g, '');
    }
}