//microservices\orders\src\kafka\kafka.consumer.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload, logLevel } from 'kafkajs';

type TopicHandler = (eventType: string, data: any) => Promise<void>;

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
    private consumer: Consumer;
    private readonly kafka: Kafka;
    private readonly handlers = new Map<string, TopicHandler>();

    constructor() {
        this.kafka = new Kafka({
            clientId: 'ms-orders-consumer1',        // ← cambiado a orders
            brokers: [process.env.KAFKA_BOOTSTRAP_SERVERS || 'kafka:9092'],
            retry: {
                initialRetryTime: 100,
                retries: 12,
                factor: 1.5,
                maxRetryTime: 30000,
            },
            connectionTimeout: 10000,
            requestTimeout: 25000,
            logLevel: logLevel.ERROR,
        });

        this.consumer = this.kafka.consumer({
            groupId: 'ms-orders-consumer-group1',   // ← cambiado a orders
            sessionTimeout: 45000,
            heartbeatInterval: 5000,
            rebalanceTimeout: 60000,
        });
    }

    registerHandler(topic: string, handler: TopicHandler) {
        this.handlers.set(topic, handler);
        console.log(`📌 Handler registrado para topic: ${topic}`);
    }

    // Solo conecta — NO suscribe todavía
    async onModuleInit() {
        try {
            await this.consumer.connect();
            console.log('✅ Kafka Consumer conectado - ms-orders');
        } catch (error) {
            console.error('❌ Error conectando Kafka Consumer:', error.message);
        }
    }

    // El listener llama esto DESPUÉS de registrar todos sus handlers
    async start() {
        try {
            const topics = Array.from(this.handlers.keys());

            if (topics.length === 0) {
                console.warn('⚠️ No hay handlers registrados, consumer inactivo');
                return;
            }

            await this.consumer.subscribe({
                topics,
                //  fromBeginning: false,
            });

            console.log(`📥 Suscrito a topics: ${topics.join(', ')}`);

            await this.consumer.run({
                autoCommit: false,
                eachMessage: async (payload: EachMessagePayload) => {
                    await this.processMessage(payload);
                },
            });

        } catch (error) {
            console.error('❌ Error iniciando suscripción Kafka:', error.message);
        }
    }

    private async processMessage({ topic, partition, message }: EachMessagePayload) {
        try {
            const raw = message.value?.toString();
            if (!raw) return;

            const event = JSON.parse(raw);

            const handler = this.handlers.get(topic);

            if (!handler) {
                console.warn(`⚠️ Sin handler para topic: ${topic}`);
                return;
            }

            await handler(event.eventType, event.data);

            // ✅ Commit manual solo si el handler no lanzó error
            await this.consumer.commitOffsets([{
                topic,
                partition,
                offset: (BigInt(message.offset) + 1n).toString(),
            }]);

        } catch (error) {
            console.error(`❌ [Kafka Consumer] Error procesando mensaje de ${topic}:`, error.message);
        }
    }

    async onModuleDestroy() {
        try {
            await this.consumer.disconnect();
            console.log('✅ Kafka Consumer desconectado limpiamente');
        } catch (e) { }
    }
}