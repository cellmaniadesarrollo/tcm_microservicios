import { MessagePurpose } from '../../whatsapp/entities/whatsapp-routing.entity';
import { WhatsappTemplateEvent } from '../../whatsapp/entities/whatsapp-template.entity';
import { OrderReplica } from '../../orders-relay/entities/order-replica.entity';

export interface SendContext {
    companyId: string;
    purpose: MessagePurpose;
    event?: WhatsappTemplateEvent;
    order?: OrderReplica;                 // ahora opcional
    /** Fuente alterna para resolver los fieldPath del contrato (eventos sin orden) */
    data?: Record<string, any>;
    /** Texto del botón de URL dinámica cuando no hay orden */
    buttonText?: string;
}

export interface INotificationChannel {
    send(recipient: string, message: string, context: SendContext): Promise<void>;
}

export const CHANNEL_WHATSAPP = 'CHANNEL_WHATSAPP';