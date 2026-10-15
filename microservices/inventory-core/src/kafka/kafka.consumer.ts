// src/kafka/kafka.consumer.ts
import {
    Injectable,
    OnApplicationBootstrap,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { Kafka, Consumer, Producer, EachMessagePayload, logLevel } from 'kafkajs';

type TopicHandler = (eventType: string, data: any) => Promise<void>;

interface FailedMessage {
    topic: string;
    partition: number;
    offset: string;
    event: any;
    attempts: number;
    lastError: string;
}

const SERVICE_NAME = 'ms-inventory-core';
// Topic donde caen los mensajes que fallaron todos los reintentos
const DLQ_TOPIC = process.env.KAFKA_DLQ_TOPIC || 'inventory-core.dlq';

@Injectable()
export class KafkaConsumerService
    implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy {
    private consumer: Consumer;
    private producer: Producer; // usado solo para la DLQ
    private readonly kafka: Kafka;
    private readonly handlers = new Map<string, TopicHandler>();
    private readonly failedMessages = new Map<string, FailedMessage>();
    private isRunning = false;
    private isConnected = false;

    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAYS = [2000, 5000, 15000];

    constructor() {
        this.kafka = new Kafka({
            clientId: `${SERVICE_NAME}-consumer`,
            brokers: (process.env.KAFKA_BOOTSTRAP_SERVERS || 'kafka:9092').split(','),
            retry: {
                initialRetryTime: 300,
                retries: 12,
                factor: 1.5,
                maxRetryTime: 30000,
            },
            connectionTimeout: 10000,
            requestTimeout: 25000,
            logLevel: logLevel.ERROR,
        });

        this.consumer = this.kafka.consumer({
            // Único por ms: así no compite con orders ni con el legacy
            groupId: process.env.KAFKA_GROUP_ID || `${SERVICE_NAME}-consumer-group`,
            sessionTimeout: 30000,
            heartbeatInterval: 3000,
            rebalanceTimeout: 30000,
            maxBytesPerPartition: 1048576,
        });

        this.producer = this.kafka.producer();

        this.consumer.on('consumer.rebalancing', () => {
            console.warn('⚠️ [Kafka] Rebalance en progreso...');
        });

        this.consumer.on('consumer.stop', () => {
            console.warn('🛑 [Kafka] Consumer detenido');
            this.isRunning = false;
        });

        this.consumer.on('consumer.crash', async ({ payload }) => {
            console.error('💥 [Kafka] Consumer crash:', payload.error?.message);
            this.isRunning = false;
            this.isConnected = false;
            await this.reconnect();
        });
    }

    /** Registra un handler por topic. Llamar desde el onModuleInit de tu módulo de dominio. */
    registerHandler(topic: string, handler: TopicHandler) {
        this.handlers.set(topic, handler);
        console.log(`📌 Handler registrado para topic: ${topic}`);
    }

    private connectPromise?: Promise<void>;

    async connect() {
        if (!this.connectPromise) {
            this.connectPromise = (async () => {
                await this.consumer.connect();
                await this.producer.connect();
                this.isConnected = true;
                console.log(`✅ Kafka Consumer conectado - ${SERVICE_NAME}`);
            })().catch((err) => {
                this.connectPromise = undefined;
                throw err;
            });
        }
        return this.connectPromise;
    }

    async onModuleInit() {
        try {
            await this.connect();
        } catch (error: any) {
            console.error('❌ Error conectando Kafka Consumer:', error.message);
        }
    }

    // Corre después de que TODOS los módulos hicieron onModuleInit (handlers ya registrados)
    async onApplicationBootstrap() {
        await this.start();
    }

    async start() {
        if (this.isRunning) return;

        try {
            const topics = Array.from(this.handlers.keys());

            if (topics.length === 0) {
                console.warn('⚠️ No hay handlers registrados, consumer inactivo');
                return;
            }

            await this.consumer.subscribe({ topics, fromBeginning: false });
            console.log(`📥 Suscrito a topics: ${topics.join(', ')}`);

            this.isRunning = true;

            await this.consumer.run({
                autoCommit: false,
                partitionsConsumedConcurrently: 3,
                eachMessage: async (payload: EachMessagePayload) => {
                    await this.processMessage(payload);
                },
            });
        } catch (error: any) {
            this.isRunning = false;
            console.error('❌ Error iniciando suscripción Kafka:', error.message);
        }
    }

    private async processMessage({ topic, partition, message }: EachMessagePayload) {
        const offsetToCommit = (BigInt(message.offset) + 1n).toString();
        const messageKey = `${topic}-${partition}-${message.offset}`;

        try {
            const raw = message.value?.toString();

            if (!raw) {
                await this.commitOffset(topic, partition, offsetToCommit);
                return;
            }

            const event = JSON.parse(raw);
            const handler = this.handlers.get(topic);

            if (!handler) {
                console.warn(`⚠️ Sin handler para topic: ${topic}`);
                await this.commitOffset(topic, partition, offsetToCommit);
                return;
            }

            await handler(event.eventType, event.data);

            this.failedMessages.delete(messageKey);
            await this.commitOffset(topic, partition, offsetToCommit);
        } catch (error) {
            await this.handleFailedMessage({
                messageKey,
                topic,
                partition,
                message,
                offsetToCommit,
                error,
            });
        }
    }

    private async handleFailedMessage({
        messageKey,
        topic,
        partition,
        message,
        offsetToCommit,
        error,
    }: {
        messageKey: string;
        topic: string;
        partition: number;
        message: EachMessagePayload['message'];
        offsetToCommit: string;
        error: any;
    }) {
        const existing = this.failedMessages.get(messageKey);
        const attempts = (existing?.attempts ?? 0) + 1;

        this.failedMessages.set(messageKey, {
            topic,
            partition,
            offset: message.offset,
            event: message.value?.toString() || '{}',
            attempts,
            lastError: error.message,
        });

        console.warn(
            `⚠️ [Kafka] Fallo #${attempts}/${this.MAX_RETRIES} | topic=${topic} offset=${message.offset} | ${error.message}`,
        );

        if (attempts < this.MAX_RETRIES) {
            const delay = this.RETRY_DELAYS[attempts - 1] ?? 15000;
            console.log(`🔄 Reintentando en ${delay}ms...`);
            await new Promise(res => setTimeout(res, delay));
            await this.processMessage({ topic, partition, message } as EachMessagePayload);
        } else {
            console.error(
                `💀 [Kafka] Mensaje enviado a DLQ tras ${this.MAX_RETRIES} intentos | topic=${topic} offset=${message.offset} | ${error.message}`,
            );
            await this.sendToDlq(topic, partition, message, error);
            this.failedMessages.delete(messageKey);
            await this.commitOffset(topic, partition, offsetToCommit);
        }
    }

    private async sendToDlq(
        topic: string,
        partition: number,
        message: EachMessagePayload['message'],
        error: any,
    ) {
        try {
            await this.producer.send({
                topic: DLQ_TOPIC,
                messages: [
                    {
                        key: message.key?.toString() ?? null,
                        value: JSON.stringify({
                            originalTopic: topic,
                            partition,
                            offset: message.offset,
                            error: error?.message,
                            failedAt: new Date().toISOString(),
                            payload: message.value?.toString() ?? null,
                        }),
                    },
                ],
            });
        } catch (dlqError: any) {
            // Si la DLQ falla, al menos queda en el log
            console.error(`❌ [Kafka] No se pudo enviar a DLQ (${DLQ_TOPIC}):`, dlqError.message);
        }
    }

    private async commitOffset(topic: string, partition: number, offset: string) {
        try {
            await this.consumer.commitOffsets([{ topic, partition, offset }]);
        } catch (error: any) {
            console.error(`❌ [Kafka] Error commiteando offset ${offset} en ${topic}:`, error.message);
        }
    }

    private async reconnect(attempt = 1) {
        const delay = Math.min(1000 * attempt, 15000);
        console.log(`🔄 [Kafka] Reconectando en ${delay}ms (intento ${attempt})...`);
        await new Promise(res => setTimeout(res, delay));

        try {
            await this.connect();
            await this.start();
            console.log('✅ [Kafka] Reconexión exitosa');
        } catch (error: any) {
            console.error('❌ [Kafka] Reconexión fallida:', error.message);
            await this.reconnect(attempt + 1);
        }
    }

    async onModuleDestroy() {
        try {
            this.isRunning = false;
            await this.producer.disconnect();
            await this.consumer.disconnect();
            console.log('✅ Kafka Consumer/Producer desconectados limpiamente');
        } catch (e) { }
    }
}