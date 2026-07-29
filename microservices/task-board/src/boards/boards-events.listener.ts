import { Injectable } from '@nestjs/common';
import { KafkaConsumerService } from '../kafka/kafka.consumer';

@Injectable()
export class BoardsEventsListener {
    constructor(private readonly kafkaConsumer: KafkaConsumerService) {}

    registerHandlers() {
        // Escuchar cuando un usuario es creado
        this.kafkaConsumer.registerHandler('user.created', async (eventType: string, data: any) => {
            console.log(`📨 Evento recibido: ${eventType}`, data);
            // Aquí puedes reaccionar al evento
        });

        // Escuchar cuando una empresa es actualizada
        this.kafkaConsumer.registerHandler('company.updated', async (eventType: string, data: any) => {
            console.log(`📨 Evento recibido: ${eventType}`, data);
        });
    }
}