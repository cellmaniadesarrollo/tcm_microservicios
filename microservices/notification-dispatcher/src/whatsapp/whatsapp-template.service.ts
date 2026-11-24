// src/whatsapp/whatsapp-template.service.ts

import {
    BadGatewayException,
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappSession } from './entities/whatsapp-session.entity';
import { WhatsappTemplate, WhatsappTemplateEvent } from './entities/whatsapp-template.entity';
import { TEMPLATE_VARIABLE_CONTRACT, TemplateComponentType } from './whatsapp-template.contract';
import { MessagePurpose } from './entities/whatsapp-routing.entity';

@Injectable()
export class WhatsappTemplateService {
    private readonly logger = new Logger(WhatsappTemplateService.name);

    constructor(
        @InjectRepository(WhatsappSession)
        private readonly sessionRepo: Repository<WhatsappSession>,
        @InjectRepository(WhatsappTemplate)
        private readonly templateRepo: Repository<WhatsappTemplate>,
    ) { }

    /**
     * Trae las plantillas aprobadas/pendientes desde Meta para el WABA de la
     * sesión y las guarda como "disponibles" (sin event asignado todavía).
     * NO las activa automáticamente — eso lo hace el usuario desde el frontend
     * eligiendo a qué evento corresponde cada una.
     */
    async syncFromMeta(companyId: string, sessionId: string): Promise<WhatsappTemplate[]> {
        const session = await this.sessionRepo.findOne({ where: { id: sessionId, companyId } });
        if (!session || session.provider !== 'OFFICIAL') {
            throw new NotFoundException('Sesión oficial no encontrada');
        }

        const url = `https://graph.facebook.com/${session.apiVersion}/${session.wabaId}/message_templates?limit=100`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${session.accessToken}` },
        });

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            this.logger.warn(`Sync de plantillas falló (${res.status}): ${body}`);
            throw new BadGatewayException('No se pudo sincronizar plantillas con Meta');
        }

        const { data } = await res.json();

        for (const remote of data) {
            const existing = await this.templateRepo.findOne({
                where: { sessionId, metaTemplateName: remote.name, language: remote.language },
            });

            const entity = this.templateRepo.create({
                ...(existing ?? {}),
                companyId,
                sessionId,
                metaTemplateName: remote.name,
                language: remote.language,
                category: remote.category,
                status: remote.status,
                components: remote.components,
                isActive: existing?.isActive ?? false,
                event: existing?.event ?? null,
            });

            await this.templateRepo.save(entity);
        }

        return this.templateRepo.find({ where: { companyId, sessionId } });
    }

    /**
     * Vincula una plantilla ya sincronizada a un evento interno del sistema.
     * Valida que la cantidad de variables del body coincida con el contrato
     * ANTES de activarla, para no romper el envío en producción.
     */
    async linkToEvent(
        companyId: string,
        templateId: string,
        event: WhatsappTemplateEvent,
    ): Promise<WhatsappTemplate> {
        const template = await this.templateRepo.findOne({ where: { id: templateId, companyId } });
        if (!template) {
            throw new NotFoundException(`Plantilla ${templateId} no encontrada`);
        }

        if (template.status !== 'APPROVED') {
            throw new BadRequestException(
                `La plantilla "${template.metaTemplateName}" no está aprobada por Meta todavía`,
            );
        }

        const contract = TEMPLATE_VARIABLE_CONTRACT[event];
        if (!contract) {
            throw new BadRequestException(`Evento "${event}" no válido`);
        }

        const expected: Record<TemplateComponentType, number> = { HEADER: 0, BODY: 0, BUTTON: 0 };
        for (const v of contract) expected[v.component ?? 'BODY']++;

        const actual = this.countVariablesByComponent(template.components);

        const diffs = (['HEADER', 'BODY', 'BUTTON'] as const)
            .filter((c) => actual[c] !== expected[c])
            .map((c) => `${c}: tiene ${actual[c]}, requiere ${expected[c]}`);

        if (diffs.length) {
            throw new BadRequestException(
                `La plantilla "${template.metaTemplateName}" (${template.language}) no cumple el contrato ` +
                `de "${event}" → ${diffs.join(' | ')}`,
            );
        }

        // Desactiva cualquier otra plantilla que ya estuviera vinculada a este evento
        // en la misma sesión, para respetar el @Unique(sessionId, event).
        await this.templateRepo.update(
            { sessionId: template.sessionId, event, isActive: true },
            { isActive: false, event: null as any },
        );

        template.event = event;
        template.isActive = true;
        template.variablesMapping = contract.map((v) => ({
            index: v.index,
            component: v.component ?? 'BODY',
            source: 'field',
            value: v.fieldPath,
        })) as any;

        return this.templateRepo.save(template);
    }

    async listBySession(companyId: string, sessionId: string): Promise<WhatsappTemplate[]> {
        return this.templateRepo.find({ where: { companyId, sessionId }, order: { metaTemplateName: 'ASC' } });
    }

    /** Cuenta variables distintas por componente ({{1}} repetido cuenta una sola vez). */
    private countVariablesByComponent(components: any[]): Record<TemplateComponentType, number> {
        const count = (text?: string) =>
            new Set((text ?? '').match(/\{\{\d+\}\}/g) ?? []).size;

        const header = components?.find((c) => c.type === 'HEADER' && c.format === 'TEXT');
        const body = components?.find((c) => c.type === 'BODY');
        const buttons: any[] = components?.find((c) => c.type === 'BUTTONS')?.buttons ?? [];

        return {
            HEADER: count(header?.text),
            BODY: count(body?.text),
            BUTTON: buttons.filter((b) => b.type === 'URL' && /\{\{\d+\}\}/.test(b.url ?? '')).length,
        };
    }

    async findActiveForEvent(
        companyId: string,
        purpose: MessagePurpose,
        event: WhatsappTemplateEvent,
    ): Promise<{ session: WhatsappSession; template: WhatsappTemplate } | null> {
        const candidates: MessagePurpose[] = purpose === 'ALL' ? ['ALL'] : [purpose, 'ALL'];

        for (const candidate of candidates) {
            const session = await this.sessionRepo.findOne({
                where: {
                    companyId,
                    provider: 'OFFICIAL',
                    status: 'CONNECTED',
                    routing: { purpose: candidate },
                },
                relations: ['routing'],
            });
            if (!session) continue;

            const template = await this.templateRepo.findOne({
                where: { sessionId: session.id, event, isActive: true, status: 'APPROVED' },
            });
            if (template) return { session, template };
        }

        return null;
    }

    hasDynamicUrlButton(components: any[]): boolean {
        const buttons = components?.find((c) => c.type === 'BUTTONS');
        if (!buttons?.buttons?.length) return false;
        return buttons.buttons.some(
            (b: any) => b.type === 'URL' && /\{\{\d+\}\}/.test(b.url ?? ''),
        );
    }
}