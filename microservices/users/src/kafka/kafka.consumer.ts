import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload, logLevel } from 'kafkajs';

// ✅ CAMBIADO: solo recibe un parámetro (data)
type TopicHandler = (data: any) => Promise<void>;

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
    private consumer: Consumer;
    private readonly kafka: Kafka;
    private readonly handlers = new Map<string, TopicHandler>();
    private started = false;

    constructor() {
        this.kafka = new Kafka({
            clientId: 'ms-users-consumer',
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
            groupId: 'ms-users-consumer-group',
            sessionTimeout: 45000,
            heartbeatInterval: 5000,
            rebalanceTimeout: 60000,
        });
    }

    registerHandler(topic: string, handler: TopicHandler) {
        this.handlers.set(topic, handler);
        console.log(`📌 Handler registrado para topic: ${topic}`);
    }

    async onModuleInit() {
        try {
            await this.consumer.connect();
            console.log('✅ Kafka Consumer conectado - ms-users');
        } catch (error: any) {
            console.error('❌ Error conectando Kafka Consumer:', error.message);
        }
    }

    async start() {
        if (this.started) {
            console.warn('⚠️ KafkaConsumer ya iniciado');
            return;
        }

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

            await this.consumer.run({
                autoCommit: false,
                eachMessage: async (payload: EachMessagePayload) => {
                    await this.processMessage(payload);
                },
            });

            this.started = true;

        } catch (error: any) {
            console.error('❌ Error iniciando suscripción Kafka:', error.message);
        }
    }

    private async processMessage({ topic, partition, message }: EachMessagePayload) {
        try {
            const raw = message.value?.toString();
            if (!raw) {
                console.warn(`⚠️ [Kafka] Mensaje vacío en ${topic}`);
                return;
            }

            let event;
            try {
                event = JSON.parse(raw);
            } catch (parseError) {
                console.error(`❌ [Kafka] Error parseando JSON en ${topic}:`, parseError);
                return;
            }

            console.log(`\n📨 [Kafka Consumer] Evento recibido`);
            console.log(`   Topic     : ${topic}`);

            // Determinar si es un evento con 'eventType' o un mensaje directo
            let dataToSend: any;
            let eventType = 'N/A';
            let source = 'N/A';
            let dataId = 'N/A';

            if (event.eventType && event.data !== undefined) {
                // Formato de evento (con eventType y data)
                eventType = event.eventType;
                source = event.source || 'N/A';
                dataId = event.data?.userId || event.data?.id || 'N/A';
                dataToSend = event.data;
                console.log(`   EventType : ${eventType}`);
                console.log(`   Source    : ${source}`);
                console.log(`   Data ID   : ${dataId}`);
            } else {
                // Formato directo (objeto plano sin eventType)
                dataToSend = event;
                dataId = event?.userId || event?.id || 'N/A';
                console.log(`   EventType : (directo)`);
                console.log(`   Data ID   : ${dataId}`);
            }

            const handler = this.handlers.get(topic);

            if (!handler) {
                console.warn(`⚠️ [Kafka] Sin handler para topic: ${topic}`);
                return;
            }

            // Mostrar datos (solo si existen)
            if (dataToSend) {
                const dataStr = JSON.stringify(dataToSend);
                console.log(`   Datos     : ${dataStr.substring(0, 250)}${dataStr.length > 250 ? '...' : ''}`);
            } else {
                console.log(`   Datos     : (vacíos)`);
            }

            await handler(dataToSend);

            await this.consumer.commitOffsets([{
                topic,
                partition,
                offset: (BigInt(message.offset) + 1n).toString(),
            }]);

        } catch (error: any) {
            console.error(`❌ [Kafka Consumer] Error procesando mensaje de ${topic}:`, error.message);
            console.error(`   Stack:`, error.stack);
        }
    }

    async onModuleDestroy() {
        try {
            await this.consumer.disconnect();
            console.log('✅ Kafka Consumer desconectado limpiamente');
        } catch (e) {
            console.error('❌ Error desconectando Kafka Consumer:', e);
        }
    }
}