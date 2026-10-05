import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload, logLevel } from 'kafkajs';

type TopicHandler = (data: any) => Promise<void>;

@Injectable()
export class KafkaConsumerService implements OnModuleDestroy {
    private consumer: Consumer;
    private readonly kafka: Kafka;
    private readonly handlers = new Map<string, TopicHandler>();

    private started = false;
    private starting = false;
    private connected = false;
    private subscribed = false;

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

    /**
     * Conecta, se suscribe y arranca el consumer con reintentos.
     * No bloquea el arranque de Nest.
     */
    async start() {
        if (this.started || this.starting) {
            console.warn('⚠️ KafkaConsumer ya iniciado o iniciándose');
            return;
        }

        const topics = Array.from(this.handlers.keys());
        if (topics.length === 0) {
            console.warn('⚠️ No hay handlers registrados, consumer inactivo');
            return;
        }

        this.starting = true;

        void (async () => {
            const maxAttempts = 10;
            for (let i = 1; i <= maxAttempts; i++) {
                try {
                    if (!this.connected) {
                        await this.consumer.connect();
                        this.connected = true;
                        console.log('✅ Kafka Consumer conectado - ms-users');
                    }

                    if (!this.subscribed) {
                        await this.consumer.subscribe({ topics, fromBeginning: false });
                        this.subscribed = true;
                    }

                    await this.consumer.run({
                        autoCommit: false,
                        eachMessage: async (payload: EachMessagePayload) => {
                            await this.processMessage(payload);
                        },
                    });

                    this.started = true;
                    this.starting = false;
                    console.log(`📥 Suscrito a topics: ${topics.join(', ')}`);
                    return;
                } catch (error: any) {
                    console.error(`❌ Consumer users intento ${i}/${maxAttempts}: ${error.message}`);
                    await new Promise((r) => setTimeout(r, 3000 * i));
                }
            }

            this.starting = false;
            console.error('❌ Consumer users NO pudo suscribirse tras 10 intentos');
        })();
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

            let dataToSend: any;
            let dataId = 'N/A';

            if (event.eventType && event.data !== undefined) {
                dataId = event.data?.userId || event.data?.id || 'N/A';
                dataToSend = event.data;
                console.log(`   EventType : ${event.eventType}`);
                console.log(`   Source    : ${event.source || 'N/A'}`);
                console.log(`   Data ID   : ${dataId}`);
            } else {
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

            // Ojo: no registrar datos completos, pueden contener tokens
            console.log(`   Datos     : (omitidos por seguridad)`);

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