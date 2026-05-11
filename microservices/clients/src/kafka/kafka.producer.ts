// src/kafka/kafka.producer.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer, logLevel } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { KafkaEvent } from './interfaces/kafka-event.interface';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
    private producer: Producer;
    private readonly kafka: Kafka;

    constructor() {
        this.kafka = new Kafka({
            clientId: 'ms-clients-producer',
            brokers: [process.env.KAFKA_BOOTSTRAP_SERVERS || 'kafka:9092'],
            retry: {
                initialRetryTime: 100,
                retries: 12,           // más reintentos
                factor: 1.5,
                maxRetryTime: 30000,
            },
            connectionTimeout: 10000,
            requestTimeout: 25000,
            logLevel: logLevel.ERROR,   // reduce ruido en logs
        });

        this.producer = this.kafka.producer({
            allowAutoTopicCreation: true,
            idempotent: true,
            transactionalId: 'ms-clients-producer-tx', // ayuda con idempotencia
        });
    }

    async onModuleInit() {
        try {
            await this.producer.connect();
            console.log('✅ Kafka Producer conectado - ms-clients');
        } catch (error) {
            console.error('❌ Error conectando Kafka Producer:', error.message);
        }
    }

    async onModuleDestroy() {
        try {
            await this.producer.disconnect();
        } catch (e) { }
    }

    async emit<T>(
        topic: string,
        eventType: string,
        data: T,
        key?: string,
    ): Promise<boolean> {
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
            try {
                const event: KafkaEvent<T> = {
                    eventId: uuidv4(),
                    eventType,
                    timestamp: new Date().toISOString(),
                    source: 'ms-clients',
                    version: 1,
                    data,
                };

                await this.producer.send({
                    topic,
                    messages: [
                        {
                            key: key || (data as any)?.id?.toString() || uuidv4(),
                            value: JSON.stringify(event),
                        },
                    ],
                });

                console.log(`📤 [Kafka] Evento emitido → ${topic} | ${eventType}`);
                return true;

            } catch (error: any) {
                attempts++;
                const isMetadataError = error.message?.includes('does not host this topic-partition') ||
                    error.message?.includes('is not the leader');

                if (isMetadataError && attempts < maxAttempts) {
                    console.warn(`⚠️ Error de metadata en Kafka (intento ${attempts}/${maxAttempts}). Reintentando...`);
                    await new Promise(resolve => setTimeout(resolve, 800 * attempts)); // backoff
                    continue;
                }

                console.error(`❌ [Kafka] Error al emitir ${eventType} a ${topic}:`, error.message);
                return false;
            }
        }
        return false;
    }
}