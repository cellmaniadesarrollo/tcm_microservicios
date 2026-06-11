import { MessagePurpose } from '../../whatsapp/entities/whatsapp-routing.entity';

export interface SendContext {
    companyId: string;
    purpose: MessagePurpose;
}

export interface INotificationChannel {
    send(recipient: string, message: string, context: SendContext): Promise<void>;
}

export const CHANNEL_WHATSAPP = 'CHANNEL_WHATSAPP';