// src/whatsapp/whatsapp-template.contract.ts

import { WhatsappTemplateEvent } from './entities/whatsapp-template.entity';

export type TemplateComponentType = 'HEADER' | 'BODY' | 'BUTTON';

export interface TemplateVariableDefinition {
    /** Posición del {{n}} dentro de su componente, empezando en 1 */
    index: number;
    /** Componente de la plantilla de Meta donde vive la variable. Por defecto: BODY */
    component?: TemplateComponentType;
    /** Texto guía que se muestra en el frontend al crear la plantilla en Meta */
    description: string;
    /** Dot-path sobre el objeto de contexto del evento usado para resolver el valor al enviar */
    fieldPath: string;
}

/**
 * Contrato fijo: define cuántas variables debe tener cada componente de la
 * plantilla de Meta para cada evento interno, y de qué campo sale cada una.
 *
 * Fuente de verdad usada en dos lugares:
 *  1. WhatsappTemplateService.linkToEvent() → valida la cantidad de variables
 *     por componente (HEADER / BODY / BUTTON).
 *  2. Generación automática de `variablesMapping` al vincular la plantilla.
 *
 * Si agregas un evento nuevo, también agrégalo al union type
 * `WhatsappTemplateEvent` en whatsapp-template.entity.ts.
 */

const ORDER_CUSTOMER_ORDER: TemplateVariableDefinition[] = [
    { index: 1, description: 'Nombre del cliente', fieldPath: 'customer.firstName' },
    { index: 2, description: 'Número de orden', fieldPath: 'orderNumber' },
];

const CUSTOMER_DEVICE: TemplateVariableDefinition[] = [
    { index: 1, description: 'Nombre del cliente', fieldPath: 'customer.firstName' },
    { index: 2, description: 'Marca del equipo', fieldPath: 'deviceBrand' },
    { index: 3, description: 'Modelo del equipo', fieldPath: 'deviceModel' },
];

export const TEMPLATE_VARIABLE_CONTRACT: Record<WhatsappTemplateEvent, TemplateVariableDefinition[]> = {
    ORDER_INGRESADO: ORDER_CUSTOMER_ORDER,
    ORDER_TRABAJO_FINALIZADO: CUSTOMER_DEVICE,
    ORDER_ENTREGADA: ORDER_CUSTOMER_ORDER,
    REMINDER_STEP_0: CUSTOMER_DEVICE,
    REMINDER_STEP_1: CUSTOMER_DEVICE,
    REMINDER_STEP_2: CUSTOMER_DEVICE,
    REMINDER_STEP_3: CUSTOMER_DEVICE,
    REMINDER_STEP_4: CUSTOMER_DEVICE,
    REMINDER_STEP_5: CUSTOMER_DEVICE,
    REMINDER_STEP_6: CUSTOMER_DEVICE,
    REMINDER_STEP_7: CUSTOMER_DEVICE,
    REMINDER_STEP_8: CUSTOMER_DEVICE,

    // Plantilla "referidos": variable en HEADER, en BODY y en el botón URL
    //   HEADER: ¡Hola {{1}}! Gracias por confiar en TeamCellMania
    //   BODY:   Tu código de referido es: {{1}} ...
    //   BUTTON: https://teamcellmania.com/mi-codigo?t={{1}}  (solo el token)
    REFERRAL_WELCOME: [
        { component: 'HEADER', index: 1, description: 'Nombre del cliente', fieldPath: 'customer.firstName' },
        { component: 'BODY', index: 1, description: 'Código de referido', fieldPath: 'referral.code' },
        { component: 'BUTTON', index: 1, description: 'Token del botón URL (solo el token, no el link completo)', fieldPath: 'referral.token' },
    ],
};