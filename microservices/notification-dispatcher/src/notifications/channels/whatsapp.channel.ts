import { Injectable, Logger } from '@nestjs/common';
import { INotificationChannel, SendContext } from './channel.interface';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { WhatsappOfficialService } from '../../whatsapp/whatsapp-official.service';
import { WhatsappTemplateService } from '../../whatsapp/whatsapp-template.service';
import { WhatsappMessageLogService } from '../../whatsapp/whatsapp-message-log.service';
import { TemplateVariableMapping } from '../../whatsapp/entities/whatsapp-template.entity';
import { WhatsappProvider } from '../../whatsapp/entities/whatsapp-session.entity';

/** El mapping guardado puede traer `component`; los antiguos no lo tienen (= BODY). */
type MappingWithComponent = TemplateVariableMapping & {
    component?: 'HEADER' | 'BODY' | 'BUTTON';
};

function getByPath(obj: any, path: string): any {
    return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

/** ¿La cabecera de la plantilla tiene una variable {{1}}? */
function headerHasVariable(components: any[]): boolean {
    const header = components?.find((c) => c.type === 'HEADER' && c.format === 'TEXT');
    return !!header?.text && /\{\{\d+\}\}/.test(header.text);
}

/** Reemplaza {{1}}, {{2}}... del BODY de la plantilla por los params enviados */
function renderTemplateBody(components: any[], params: string[]): string | null {
    const body = components?.find((c) => c.type === 'BODY');
    if (!body?.text) return null;
    return body.text.replace(/\{\{(\d+)\}\}/g, (_: string, n: string) => params[Number(n) - 1] ?? '');
}

@Injectable()
export class WhatsappChannel implements INotificationChannel {
    private readonly logger = new Logger(WhatsappChannel.name);

    constructor(
        private readonly whatsapp: WhatsappService,
        private readonly official: WhatsappOfficialService,
        private readonly templates: WhatsappTemplateService,
        private readonly msgLog: WhatsappMessageLogService,
    ) { }

    async send(recipient: string, message: string, context: SendContext): Promise<void> {
        let fallbackFrom: WhatsappProvider | null = null;

        if (context.event) {
            const result = await this.trySendOfficial(recipient, context);
            if (result.sent) return;
            if (result.attempted) fallbackFrom = 'OFFICIAL';
        }

        const base = {
            companyId: context.companyId,
            purpose: context.purpose,
            provider: 'BAILEYS' as WhatsappProvider,
            recipient,
            messageType: 'TEXT' as const,
            templateEvent: context.event ?? null,
            body: message,
            fallbackFrom,
            orderId: context.order?.id ?? null,
        };

        try {
            const r = await this.whatsapp.sendTextTracked(
                context.companyId, context.purpose, recipient, message,
            );
            await this.msgLog.record({
                ...base,
                sessionId: r.sessionId,
                fromNumber: r.fromNumber,
                waMessageId: r.messageId,
                status: 'SENT',
            });
            this.logger.log(`WhatsApp (Baileys) enviado a ${recipient} [${context.purpose}]`);
        } catch (err: any) {
            await this.msgLog.record({
                ...base,
                status: 'FAILED',
                errorMessage: err?.message ?? 'Error desconocido',
            });
            throw err; // para que NotificationsService siga registrando FAILED
        }
    }

    private async trySendOfficial(
        recipient: string,
        context: SendContext,
    ): Promise<{ sent: boolean; attempted: boolean }> {
        let match: Awaited<ReturnType<WhatsappTemplateService['findActiveForEvent']>> = null;
        try {
            match = await this.templates.findActiveForEvent(
                context.companyId, context.purpose, context.event!,
            );
        } catch (err: any) {
            this.logger.warn(`findActiveForEvent falló: ${err?.message}`);
        }
        if (!match) return { sent: false, attempted: false };

        const { session, template } = match;

        const base = {
            companyId: context.companyId,
            purpose: context.purpose,
            provider: 'OFFICIAL' as WhatsappProvider,
            sessionId: session.id,
            fromNumber: session.phoneNumber ?? null,
            recipient,
            messageType: 'TEMPLATE' as const,
            templateName: template.metaTemplateName,
            templateEvent: context.event ?? null,
            orderId: context.order?.id ?? null,
        };

        let params: string[] = [];
        let body: string | null = null;

        try {
            // Fuente de variables: data (eventos sin orden) o la orden
            const source = context.data ?? context.order;

            const mapping = (template.variablesMapping ?? []) as MappingWithComponent[];
            const resolve = (m: MappingWithComponent): string =>
                m.source === 'static' ? String(m.value ?? '') : String(getByPath(source, m.value) ?? '');

            const valuesFor = (component: 'HEADER' | 'BODY' | 'BUTTON'): string[] =>
                mapping
                    .filter((m) => (m.component ?? 'BODY') === component)
                    .sort((a, b) => a.index - b.index)
                    .map(resolve);

            // BODY: mappings sin `component` (plantillas antiguas) cuentan como BODY
            params = valuesFor('BODY');
            body = renderTemplateBody(template.components, params);

            // HEADER: si el mapping lo define se usa; si no, comportamiento anterior
            const headerValues = valuesFor('HEADER');
            const headerParams = headerValues.length
                ? headerValues
                : headerHasVariable(template.components)
                    ? [String(getByPath(source, 'customer.firstName') ?? '')]
                    : [];

            // BUTTON: el mapping manda; si no hay, comportamiento anterior (órdenes)
            const buttonValues = valuesFor('BUTTON');
            const buttonParams = this.templates.hasDynamicUrlButton(template.components)
                ? [{
                    index: 0,
                    text: String(
                        buttonValues[0] ??
                        context.buttonText ??
                        context.order?.publicId ??
                        context.order?.orderNumber ??
                        '',
                    ),
                }]
                : undefined;

            const { messageId } = await this.official.sendTemplate(
                session,
                recipient,
                template.metaTemplateName,
                template.language,
                params,
                buttonParams,
                headerParams,
            );

            await this.msgLog.record({ ...base, body, waMessageId: messageId, status: 'SENT' });
            this.logger.log(
                `WhatsApp (Oficial) enviado a ${recipient} [${context.event}] vía "${template.metaTemplateName}"`,
            );
            return { sent: true, attempted: true };
        } catch (err: any) {
            await this.msgLog.record({
                ...base, body, status: 'FAILED', errorMessage: err?.message ?? 'Error desconocido',
            });
            this.logger.warn(
                `Envío oficial falló para ${recipient} [${context.event}], cae a Baileys: ${err?.message}`,
            );
            return { sent: false, attempted: true };
        }
    }
}