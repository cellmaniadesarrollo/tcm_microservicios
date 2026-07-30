import { WhatsappTemplateEvent } from '../../whatsapp/entities/whatsapp-template.entity';

export const ORDER_STATUS_TO_EVENT: Record<string, WhatsappTemplateEvent> = {
    INGRESADO: 'ORDER_INGRESADO',
    'TRABAJO FINALIZADO': 'ORDER_TRABAJO_FINALIZADO',
    ENTREGADA: 'ORDER_ENTREGADA',
};

export function reminderStepToEvent(step: number): WhatsappTemplateEvent {
    return `REMINDER_STEP_${step}` as WhatsappTemplateEvent;
}