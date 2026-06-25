// src/kafka/kafka.producer.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer, logLevel } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';

export interface KafkaEvent<T = any> {
  eventId: string;
  eventType: string;
  timestamp: string;
  source: string;
  version: number;
  data: T;
}

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private producer: Producer;
  private readonly kafka: Kafka;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'ms-taskboard-producer',
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

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      idempotent: true,
    });
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      console.log('✅ Kafka Producer conectado - ms-taskboard');
    } catch (error: any) {
      console.error('❌ Error conectando Kafka Producer:', error.message);
    }
  }

  async onModuleDestroy() {
    try {
      await this.producer.disconnect();
      console.log('✅ Kafka Producer desconectado - ms-taskboard');
    } catch (e) {
      // Ignorar errores al desconectar
    }
  }

  /**
   * Envía un mensaje a Kafka y espera respuesta (request-response)
   * ⚠️ Nota: Para request-response con Kafka, necesitas implementar un sistema de correlationId
   * Por ahora es fire-and-forget
   */
  async send<T = any>(topic: string, data: any): Promise<T> {
    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: data?.userId || data?.id || uuidv4(),
            value: JSON.stringify(data),
          },
        ],
      });
      console.log(`📤 [Kafka] Mensaje enviado a ${topic}`);
      return {} as T;
    } catch (error: any) {
      console.error(`❌ [Kafka] Error enviando mensaje a ${topic}:`, error.message);
      throw new Error(`Error enviando mensaje a Kafka: ${error.message}`);
    }
  }

  /**
   * Envía un evento a Kafka (fire-and-forget)
   */
  async emit<T>(
    topic: string,
    eventType: string,
    data: T,
    key?: string,
  ): Promise<boolean> {
    try {
      const event: KafkaEvent<T> = {
        eventId: uuidv4(),
        eventType,
        timestamp: new Date().toISOString(),
        source: 'ms-taskboard',
        version: 1,
        data,
      };

      await this.producer.send({
        topic,
        messages: [
          {
            key: key || (data as any)?.userId?.toString() || (data as any)?.id?.toString() || uuidv4(),
            value: JSON.stringify(event),
          },
        ],
      });

      console.log(`📤 [Kafka] Evento emitido → ${topic} | ${eventType}`);
      return true;
    } catch (error: any) {
      console.error(`❌ [Kafka] Error al emitir ${eventType}:`, error.message);
      return false;
    }
  }
}