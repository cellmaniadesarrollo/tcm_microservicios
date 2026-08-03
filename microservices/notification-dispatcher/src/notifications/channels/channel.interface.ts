import { MessagePurpose } from '../../whatsapp/entities/whatsapp-routing.entity';
import { WhatsappTemplateEvent } from '../../whatsapp/entities/whatsapp-template.entity';
import { OrderReplica } from '../../orders-relay/entities/order-replica.entity';

export interface SendContext {
    companyId: string;
    purpose: MessagePurpose;
    event?: WhatsappTemplateEvent;
    order: OrderReplica;
}

export interface INotificationChannel {
    send(recipient: string, message: string, context: SendContext): Promise<void>;
}

export const CHANNEL_WHATSAPP = 'CHANNEL_WHATSAPP';