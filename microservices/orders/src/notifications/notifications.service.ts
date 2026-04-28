// src/notifications/notifications.service.ts

import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class NotificationsService {

    constructor(
        @Inject('REALTIME_SERVICE')
        private readonly realtimeClient: ClientProxy,
    ) { }

    /**
     * Emite una actualización de orden de forma ESTÁNDAR y completa
     * @param order - Información básica de la orden actualizada
     * @param action - Tipo de acción realizada (status_changed, note_added, attachment_added, etc.)
     * @param description - Descripción corta y amigable del cambio
     * @param changedBy - Usuario que realizó el cambio
     * @param extraData - Datos adicionales específicos del cambio (opcional)
     */
    async emitOrderUpdated(
        order: {
            id: number | string;
            orderNumber: number | string;
            customerName: string;
            status: string;
            branch?: string;
            // Puedes agregar más campos comunes si los necesitas
        },
        action: string,
        description: string,
        changedBy: string,
        company_id: string
    ) {
        const payload = {
            event: 'order.updated',
            order_id: order.id,
            company_id,
            order: {                          // ← Objeto estandarizado de la orden
                id: order.id,
                orderNumber: order.orderNumber,
                customerName: order.customerName,
                status: order.status,
                branch: order.branch,
            },
            action,                           // "status_changed", "attachment_added", etc.
            description,                      // Descripción corta y clara
            changed_by: changedBy,
            timestamp: new Date().toISOString(),
        };

        try {
            await lastValueFrom(
                this.realtimeClient.emit('order.updated', payload)
            );
            console.log(`✅ Evento order.updated emitido → Action: ${action} | Orden: ${order.orderNumber} (${order.id})`);
        } catch (error) {
            console.error(`❌ Error al emitir order.updated (${action} - Orden ${order.id}):`, error);
        }
    }

    // Mantén emitOrderCreated si lo necesitas
    async emitOrderCreated(orderCreate: any, order: {
        id: number | string;
        orderNumber: number | string;
        customerName: string;
        status: string;
        branch?: string;
        // Puedes agregar más campos comunes si los necesitas
    },

        CreateBy: string,
        company_id: string) {
        try {

            const technicians = orderCreate.technicians?.map((tech: any) => ({
                id: tech.id,
                username: tech.username,
                first_name: tech.first_name,
                last_name: tech.last_name,
            }))

            const payload = {
                event: 'order.created',
                order_id: order.id,
                company_id: company_id,
                order: {
                    id: order.id,
                    orderNumber: order.orderNumber,
                    customerName: order.customerName,
                    status: order.status,
                    branch: order.branch,
                },
                action: "Orden Creada",
                detalleIngreso: orderCreate.detalleIngreso,
                created_by: CreateBy,
                technicians,
                timestamp: new Date().toISOString(),
            };

            await lastValueFrom(
                this.realtimeClient.emit('order.created', payload)
            );
            console.log('✅ Evento order.created emitido');
        } catch (error) {
            console.error('❌ Error al emitir order.created:', error);
        }
    }
}


