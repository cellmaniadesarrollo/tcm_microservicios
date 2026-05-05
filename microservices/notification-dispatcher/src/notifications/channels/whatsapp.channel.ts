import { Injectable, Logger } from '@nestjs/common';
import { INotificationChannel } from './channel.interface';
import { WhatsappService } from '../../whatsapp/whatsapp.service';

@Injectable()
export class WhatsappChannel implements INotificationChannel {
    private readonly logger = new Logger(WhatsappChannel.name);

    constructor(private readonly whatsapp: WhatsappService) { }

    async send(recipient: string, message: string): Promise<void> {
        await this.whatsapp.sendText(recipient, message);
        this.logger.log(`WhatsApp enviado a ${recipient}`);
    }
}