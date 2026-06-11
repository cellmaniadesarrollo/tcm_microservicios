import { Injectable, Logger } from '@nestjs/common';
import { INotificationChannel, SendContext } from './channel.interface';
import { WhatsappService } from '../../whatsapp/whatsapp.service';

@Injectable()
export class WhatsappChannel implements INotificationChannel {
    private readonly logger = new Logger(WhatsappChannel.name);

    constructor(private readonly whatsapp: WhatsappService) { }

    async send(recipient: string, message: string, context: SendContext): Promise<void> {
        await this.whatsapp.sendText(context.companyId, context.purpose, recipient, message);
        this.logger.log(`WhatsApp enviado a ${recipient} [${context.purpose}]`);
    }
}