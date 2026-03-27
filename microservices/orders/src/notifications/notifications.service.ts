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

    // Ejemplo: emitir cuando se crea una orden
    async emitOrderCreated(orderData: any) {
        try {
            await lastValueFrom(
                this.realtimeClient.emit('order.created', orderData)
            );
            console.log('✅ Evento order.created emitido a RabbitMQ');
        } catch (error) {
            console.error('❌ Error al emitir order.created:', error);
        }
    }

    // Ejemplo: cuando se actualiza una orden
    async emitOrderUpdated(orderData: any) {
        try {
            await lastValueFrom(
                this.realtimeClient.emit('order.updated', orderData)
            );
            console.log('✅ Evento order.updated emitido a RabbitMQ');
        } catch (error) {
            console.error('❌ Error al emitir order.updated:', error);
        }
    }

    // Puedes agregar más métodos: order.statusChanged, order.cancelled, etc.
}