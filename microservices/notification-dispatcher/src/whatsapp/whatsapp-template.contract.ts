// src/whatsapp/whatsapp-template.contract.ts

import { WhatsappTemplateEvent } from './entities/whatsapp-template.entity';

export interface TemplateVariableDefinition {
    /** Posición del {{n}} en el body de la plantilla, empezando en 1 */
    index: number;
    /** Texto guía que se muestra en el frontend al crear la plantilla en Meta */
    description: string;
    /** Dot-path sobre OrderReplica usado para resolver el valor al enviar */
    fieldPath: string;
}

/**
 * Contrato fijo: define cuántas variables debe tener el body de la plantilla
 * de Meta para cada evento interno, y de qué campo de la orden sale cada una.
 *
 * Este catálogo es la fuente de verdad usada en dos lugares:
 *  1. WhatsappTemplateService.linkToEvent() → valida que la plantilla que el
 *     usuario vincula tenga la cantidad correcta de variables.
 *  2. Generación automática de `variablesMapping` al vincular la plantilla,
 *     así el usuario no arma el mapeo a mano.
 *
 * Si agregás un evento nuevo acá, también agregalo al union type
 * `WhatsappTemplateEvent` en whatsapp-template.entity.ts.
 */
export const TEMPLATE_VARIABLE_CONTRACT: Record<WhatsappTemplateEvent, TemplateVariableDefinition[]> = {
    ORDER_INGRESADO: [
        { index: 1, description: 'Nombre del cliente', fieldPath: 'customer.firstName' },
        { index: 2, description: 'Número de orden', fieldPath: 'orderNumber' },
    ],
    ORDER_TRABAJO_FINALIZADO: [
        { index: 1, description: 'Nombre del cliente', fieldPath: 'customer.firstName' },
        { index: 2, description: 'Marca del equipo', fieldPath: 'deviceBrand' },
        { index: 3, description: 'Modelo del equipo', fieldPath: 'deviceModel' },
    ],
    ORDER_ENTREGADA: [
        { index: 1, description: 'Nombre del cliente', fieldPath: 'customer.firstName' },
        { index: 2, description: 'Número de orden', fieldPath: 'orderNumber' },
    ],
    REMINDER_STEP_0: [
        { index: 1, description: 'Nombre del cliente', fieldPath: 'customer.firstName' },
        { index: 2, description: 'Marca del equipo', fieldPath: 'deviceBrand' },
        { index: 3, description: 'Modelo del equipo', fieldPath: 'deviceModel' },
    ],
    REMINDER_STEP_1: [
        { index: 1, description: 'Nombre del cliente', fieldPath: 'customer.firstName' },
        { index: 2, description: 'Marca del equipo', fieldPath: 'deviceBrand' },
        { index: 3, description: 'Modelo del equipo', fieldPath: 'deviceModel' },
    ],
    REMINDER_STEP_2: [
        { index: 1, description: 'Nombre del cliente', fieldPath: 'customer.firstName' },
        { index: 2, description: 'Marca del equipo', fieldPath: 'deviceBrand' },
        { index: 3, description: 'Modelo del equipo', fieldPath: 'deviceModel' },
    ],
    REMINDER_STEP_3: [
        { index: 1, description: 'Nombre del cliente', fieldPath: 'customer.firstName' },
        { index: 2, description: 'Marca del equipo', fieldPath: 'deviceBrand' },
        { index: 3, description: 'Modelo del equipo', fieldPath: 'deviceModel' },
    ],
    REMINDER_STEP_4: [
        { index: 1, description: 'Nombre del cliente', fieldPath: 'customer.firstName' },
        { index: 2, description: 'Marca del equipo', fieldPath: 'deviceBrand' },
        { index: 3, description: 'Modelo del equipo', fieldPath: 'deviceModel' },
    ],
    REMINDER_STEP_5: [
        { index: 1, description: 'Nombre del cliente', fieldPath: 'customer.firstName' },
        { index: 2, description: 'Marca del equipo', fieldPath: 'deviceBrand' },
        { index: 3, description: 'Modelo del equipo', fieldPath: 'deviceModel' },
    ],
    REMINDER_STEP_6: [
        { index: 1, description: 'Nombre del cliente', fieldPath: 'customer.firstName' },
        { index: 2, description: 'Marca del equipo', fieldPath: 'deviceBrand' },
        { index: 3, description: 'Modelo del equipo', fieldPath: 'deviceModel' },
    ],
    REMINDER_STEP_7: [
        { index: 1, description: 'Nombre del cliente', fieldPath: 'customer.firstName' },
        { index: 2, description: 'Marca del equipo', fieldPath: 'deviceBrand' },
        { index: 3, description: 'Modelo del equipo', fieldPath: 'deviceModel' },
    ],
    REMINDER_STEP_8: [
        { index: 1, description: 'Nombre del cliente', fieldPath: 'customer.firstName' },
        { index: 2, description: 'Marca del equipo', fieldPath: 'deviceBrand' },
        { index: 3, description: 'Modelo del equipo', fieldPath: 'deviceModel' },
    ],
};