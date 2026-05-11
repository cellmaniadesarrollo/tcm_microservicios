// microservices/orders/src/notifications/notifications.service.ts

import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class NotificationsService {

    constructor(
        @Inject('REALTIME_SERVICE')
        private readonly realtimeClient: ClientProxy,
        // @Inject('NOTIFICATIONS_SAVE_CLIENT')
        // private readonly notificationsSaveClient: ClientProxy,
    ) { }

    async emitOrderUpdated(
        order: {
            id: number | string;
            orderNumber: number | string;
            customerName: string;
            status: string;
            branch?: string;
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
            userId: changedBy,  // ← Agregar userId
            userName: changedBy,  // ← Agregar userName (nombre real)
            order: {
                id: order.id,
                orderNumber: order.orderNumber,
                customerName: order.customerName,
                status: order.status,
                branch: order.branch,
            },
            action,
            description,
            changed_by: changedBy,
            timestamp: new Date().toISOString(),
        };

        try {
            await lastValueFrom(this.realtimeClient.emit('order.updated', payload));
            console.log(`✅ Evento order.updated enviado a WebSocket → Action: ${action}`);
            
            // await lastValueFrom(this.notificationsSaveClient.emit('order.updated', payload));
            // console.log(`✅ Evento order.updated enviado a Notifications para guardar`);
            
        } catch (error) {
            console.error(`❌ Error al emitir order.updated:`, error);
        }
    }

    async emitOrderCreated(orderCreate: any, order: {
        id: number | string;
        orderNumber: number | string;
        customerName: string;
        status: string;
        branch?: string;
    },
        CreateBy: string,
        company_id: string,
        userName?: string) {  // ← Agregar parámetro userName
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
                userId: CreateBy,
                userName: userName || CreateBy,  // ← Agregar nombre real del usuario
                created_by: CreateBy,
                order: {
                    id: order.id,
                    orderNumber: order.orderNumber,
                    customerName: order.customerName,
                    status: order.status,
                    branch: order.branch,
                },
                action: "Orden Creada",
                detalleIngreso: orderCreate.detalleIngreso,
                technicians,
                device: orderCreate.device || null,
                timestamp: new Date().toISOString(),
            };

            await lastValueFrom(this.realtimeClient.emit('order.created', payload));
            console.log('✅ Evento order.created enviado a WebSocket');
            
            // await lastValueFrom(this.notificationsSaveClient.emit('order.created', payload));
            // console.log('✅ Evento order.created enviado a Notifications para guardar');
            
        } catch (error) {
            console.error('❌ Error al emitir order.created:', error);
        }
    }
} 