// /src\catalogs\catalogs-events.listener.ts
import { Injectable } from '@nestjs/common';
import { KafkaConsumerService } from '../kafka/kafka.consumer';
import { ModelsSyncService } from './models-sync.service';
import { TechnicalModelsSyncService } from './technical-models-sync.service';

const TOPICS = {
    MODEL_CREATED: 'ms.catalog.model.created',
    MODEL_TECHNICAL_UPDATED: 'ms.catalog.model.technical.updated',
} as const;

@Injectable()
export class CatalogsEventsListener {
    constructor(
        private readonly kafkaConsumer: KafkaConsumerService,
        private readonly modelsSync: ModelsSyncService,
        private readonly technicalSync: TechnicalModelsSyncService,
    ) { }

    // El orquestador llama esto
    registerHandlers() {
        this.kafkaConsumer.registerHandler(
            TOPICS.MODEL_CREATED,
            (eventType, data) => this.handleModelCreated(eventType, data),
        );
        this.kafkaConsumer.registerHandler(
            TOPICS.MODEL_TECHNICAL_UPDATED,
            (eventType, data) => this.handleTechnicalUpdated(eventType, data),
        );
    }

    private async handleModelCreated(eventType: string, data: any) {
        console.log(`📱 [${eventType}] Modelo nuevo: ${data?.sourceId}`);

        // Payload inválido: reintentar no lo arregla, se ignora.
        if (!data?.sourceId || !data?.numericId || !data?.name || !data?.brand?.id || !data?.brand?.sourceId) {
            console.warn(`⚠️ [${eventType}] Payload incompleto, se ignora`);
            return;
        }

        await this.modelsSync.saveBatch([data]);
    }

    private async handleTechnicalUpdated(eventType: string, data: any) {
        console.log(`🔧 [${eventType}] Códigos técnicos: ${data?.sourceId}`);

        if (!data?.sourceId || !Array.isArray(data?.technicalModels)) {
            console.warn(`⚠️ [${eventType}] Payload incompleto, se ignora`);
            return;
        }

        const result = await this.technicalSync.saveBatch([data]);

        // El modelo aún no existe: lanzar error activa los reintentos del consumer
        if (result.skipped > 0) {
            throw new Error(`Modelo ${data.sourceId} aún no existe en models`);
        }
    }
}