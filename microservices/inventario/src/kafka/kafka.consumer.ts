import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload, logLevel } from 'kafkajs';
import { ConfigService } from '@nestjs/config';

type TopicHandler = (eventType: string, data: any) => Promise<void>;

@Injectable()
export class KafkaConsumer implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(KafkaConsumer.name);
    private consumer: Consumer;
    private readonly kafka: Kafka;
    private readonly handlers = new Map<string, TopicHandler>();
    private isRunning = false;

    constructor(private configService: ConfigService) {
        const brokers = this.configService.get<string>('KAFKA_BOOTSTRAP_SERVERS', 'kafka:9092');

        this.kafka = new Kafka({
            clientId: 'ms-inventario-consumer',
            brokers: brokers.split(','),
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
            groupId: 'ms-inventario-consumer-group',
            sessionTimeout: 45000,
            heartbeatInterval: 5000,
            rebalanceTimeout: 60000,
        });
    }

    registerHandler(topic: string, handler: TopicHandler) {
        this.handlers.set(topic, handler);
        this.logger.log(`📌 Handler registrado para topic: ${topic}`);
    }

    async onModuleInit() {
        try {
            await this.consumer.connect();
            this.logger.log('✅ Kafka Consumer conectado - ms-inventario');
        } catch (error: any) {
            this.logger.error('❌ Error conectando Kafka Consumer:', error.message);
        }
    }

    async start() {
        try {
            const topics = Array.from(this.handlers.keys());

            if (topics.length === 0) {
                this.logger.warn('⚠️ No hay handlers registrados, consumer inactivo');
                return;
            }

            // ✅ Suscribir ANTES de run()
            await this.consumer.subscribe({
                topics,
            });

            this.logger.log(`📥 Suscrito a topics: ${topics.join(', ')}`);

            this.isRunning = true;

            await this.consumer.run({
                autoCommit: false,
                eachMessage: async (payload: EachMessagePayload) => {
                    await this.processMessage(payload);
                },
            });

        } catch (error: any) {
            this.logger.error('❌ Error iniciando suscripción Kafka:', error.message);
        }
    }

    private async processMessage({ topic, partition, message }: EachMessagePayload) {
        try {
            const raw = message.value?.toString();
            if (!raw) return;

            const event = JSON.parse(raw);

            const handler = this.handlers.get(topic);

            if (!handler) {
                this.logger.warn(`⚠️ Sin handler para topic: ${topic}`);
                return;
            }

            await handler(event.eventType, event.data);

            await this.consumer.commitOffsets([{
                topic,
                partition,
                offset: (BigInt(message.offset) + 1n).toString(),
            }]);

        } catch (error: any) {
            this.logger.error(`❌ [Kafka Consumer] Error procesando mensaje de ${topic}:`, error.message);
        }
    }

    async onModuleDestroy() {
        try {
            this.isRunning = false;
            await this.consumer.disconnect();
            this.logger.log('✅ Kafka Consumer desconectado limpiamente');
        } catch (e) { }
    }
}