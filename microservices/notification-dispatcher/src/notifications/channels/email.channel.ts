import { Injectable, Logger } from '@nestjs/common';
import { INotificationChannel } from './channel.interface';

@Injectable()
export class EmailChannel implements INotificationChannel {
    private readonly logger = new Logger(EmailChannel.name);

    async send(recipient: string, message: string): Promise<void> {
        // Aquí conectas tu proveedor (nodemailer, SendGrid, etc.)
        this.logger.log(`Email enviado a ${recipient}: ${message}`);
    }
}