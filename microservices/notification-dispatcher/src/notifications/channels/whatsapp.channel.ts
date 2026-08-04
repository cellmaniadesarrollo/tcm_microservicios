import { Injectable, Logger } from '@nestjs/common';
import { INotificationChannel, SendContext } from './channel.interface';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { WhatsappOfficialService } from '../../whatsapp/whatsapp-official.service';
import { WhatsappTemplateService } from '../../whatsapp/whatsapp-template.service';
import { TemplateVariableMapping } from '../../whatsapp/entities/whatsapp-template.entity';

function getByPath(obj: any, path: string): any {
    return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

@Injectable()
export class WhatsappChannel implements INotificationChannel {
    private readonly logger = new Logger(WhatsappChannel.name);

    constructor(
        private readonly whatsapp: WhatsappService,
        private readonly official: WhatsappOfficialService,
        private readonly templates: WhatsappTemplateService,
    ) { }

    async send(recipient: string, message: string, context: SendContext): Promise<void> {
        if (context.event) {
            const sentByOfficial = await this.trySendOfficial(recipient, context);
            if (sentByOfficial) return;
        }

        await this.whatsapp.sendText(context.companyId, context.purpose, recipient, message);
        this.logger.log(`WhatsApp (Baileys) enviado a ${recipient} [${context.purpose}]`);
    }

    private async trySendOfficial(recipient: string, context: SendContext): Promise<boolean> {
        try {
            const match = await this.templates.findActiveForEvent(
                context.companyId,
                context.purpose,
                context.event!,
            );
            if (!match) return false;

            const { session, template } = match;

            const params = [...(template.variablesMapping ?? [])]
                .sort((a: TemplateVariableMapping, b: TemplateVariableMapping) => a.index - b.index)
                .map((m: TemplateVariableMapping) =>
                    m.source === 'static' ? m.value : String(getByPath(context.order, m.value) ?? ''),
                );

            const buttonParams = this.templates.hasDynamicUrlButton(template.components)
                ? [{ index: 0, text: String(context.order.publicId ?? context.order.orderNumber ?? '') }]
                : undefined;

            await this.official.sendTemplate(
                session,
                recipient,
                template.metaTemplateName,
                template.language,
                params,
                buttonParams,
            );

            this.logger.log(
                `WhatsApp (Oficial) enviado a ${recipient} [${context.event}] vía "${template.metaTemplateName}"`,
            );
            return true;
        } catch (err: any) {
            this.logger.warn(
                `Envío oficial falló para ${recipient} [${context.event}], cae a Baileys: ${err?.message}`,
            );
            return false;
        }
    }
}