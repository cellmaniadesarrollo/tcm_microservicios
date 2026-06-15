// microservices/orders/src/kafka/kafka.consumer.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
    private consumer: Consumer;
    private producer: Producer;
    private readonly kafka: Kafka;
    private readonly handlers = new Map<string, TopicHandler>();
    private readonly failedMessages = new Map<string, FailedMessage>();
    private isRunning = false;

    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAYS = [2000, 5000, 15000];

    constructor() {
        this.kafka = new Kafka({
            clientId: 'ms-orders-consumer',
            brokers: [process.env.KAFKA_BOOTSTRAP_SERVERS || 'kafka:9092'],
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
            groupId: 'ms-orders-consumer-group',
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
            await this.reconnect();
        });
    }

    registerHandler(topic: string, handler: TopicHandler) {
        this.handlers.set(topic, handler);
        console.log(`📌 Handler registrado para topic: ${topic}`);
    }

    async onModuleInit() {
        try {
            await this.consumer.connect();
            await this.producer.connect();
            console.log('✅ Kafka Consumer conectado - ms-orders');
        } catch (error: any) {
            console.error('❌ Error conectando Kafka Consumer:', error.message);
        }
    }

    async start() {
        try {
            const topics = Array.from(this.handlers.keys());

            if (topics.length === 0) {
                console.warn('⚠️ No hay handlers registrados, consumer inactivo');
                return;
            }

            await this.consumer.subscribe({
                topics,
                fromBeginning: false,
            });

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
            `⚠️ [Kafka] Fallo #${attempts}/${this.MAX_RETRIES} | topic=${topic} offset=${message.offset} | ${error.message}`
        );

        if (attempts < this.MAX_RETRIES) {
            const delay = this.RETRY_DELAYS[attempts - 1] ?? 15000;
            console.log(`🔄 Reintentando en ${delay}ms...`);
            await new Promise(res => setTimeout(res, delay));
            await this.processMessage({ topic, partition, message } as EachMessagePayload);
        } else {
            // Mensaje descartado silenciosamente: no se emite ni guarda en ningún topic
            console.error(
                `💀 [Kafka] Mensaje descartado tras ${this.MAX_RETRIES} intentos | topic=${topic} offset=${message.offset} | ${error.message}`
            );
            this.failedMessages.delete(messageKey);
            await this.commitOffset(topic, partition, offsetToCommit);
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
            await this.consumer.connect();
            await this.producer.connect();
            await this.start();
            console.log('✅ [Kafka] Reconexión exitosa');
        } catch (error: any) {
            console.error(`❌ [Kafka] Reconexión fallida:`, error.message);
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