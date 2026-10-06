import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
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
  private consumer: Consumer;
  private readonly kafka: Kafka;

  private producerUp = false;
  private consumerConnected = false;
  private consumerSubscribed = false;
  private consumerRunning = false;
  private connecting: Promise<void> | null = null;
  private groupReady: Promise<void> | null = null;

  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timeout: NodeJS.Timeout;
  }>();

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

    this.consumer = this.kafka.consumer({
      groupId: 'ms-taskboard-response-group-v2',
      sessionTimeout: 45000,
      heartbeatInterval: 5000,
      rebalanceTimeout: 60000,
    });
  }

  async onModuleInit() {
    this.producer.on(this.producer.events.DISCONNECT, () => {
      console.warn('⚠️ [Kafka] Producer desconectado, se reconectará en el próximo uso');
      this.producerUp = false;
    });

    // Reintenta en segundo plano sin bloquear ni tumbar el arranque de la app
    void (async () => {
      for (let i = 1; i <= 10; i++) {
        try {
          await this.ensureConnected();
          return;
        } catch (e: any) {
          console.error(`❌ Kafka intento ${i}/10: ${e.message}`);
          await new Promise((r) => setTimeout(r, 3000 * i));
        }
      }
      console.error('❌ Kafka: no se pudo conectar al arrancar; se reintentará bajo demanda');
    })();
  }

  async onModuleDestroy() {
    try {
      await this.producer.disconnect();
      await this.consumer.disconnect();
      console.log('✅ Kafka desconectado limpiamente');
    } catch (e) {
      // Ignorar errores al desconectar
    }
  }

  // ==================== CONEXIÓN ====================

  private ensureConnected(): Promise<void> {
    if (this.producerUp && this.consumerRunning) return Promise.resolve();
    if (!this.connecting) {
      this.connecting = this.connectAll().finally(() => {
        this.connecting = null;
      });
    }
    return this.connecting;
  }

  private async connectAll() {
    if (!this.producerUp) {
      await this.producer.connect();
      this.producerUp = true;
      console.log('✅ Kafka Producer conectado - ms-taskboard');
    }

    if (!this.consumerRunning) {
      if (!this.consumerConnected) {
        await this.consumer.connect();
        this.consumerConnected = true;
      }
      if (!this.consumerSubscribed) {
        await this.consumer.subscribe({
          topics: ['taskboard.responses'],
          fromBeginning: false,
        });
        this.consumerSubscribed = true;
      }

      // Espera a que el consumer realmente se una al grupo
      const joined = new Promise<void>((resolve) => {
        const remove = this.consumer.on(this.consumer.events.GROUP_JOIN, () => {
          remove();
          resolve();
        });
      });

      await this.consumer.run({
        eachMessage: async ({ message }) => {
          await this.handleResponse(message);
        },
      });

      await Promise.race([
        joined,
        new Promise<void>((r) => setTimeout(r, 15000)),
      ]);

      this.consumerRunning = true;
      console.log('✅ Kafka Response Consumer conectado - ms-taskboard');
    }
  }

  // ==================== RESPUESTAS ====================

  private async handleResponse(message: any) {
    try {
      const raw = message.value?.toString();
      if (!raw) {
        console.warn('⚠️ [Kafka] Mensaje de respuesta vacío');
        return;
      }

      const event = JSON.parse(raw);

      // El requestId está dentro de event.data (porque users usa emit con estructura de evento)
      const responseData = event.data || event;
      const requestId = responseData.requestId;

      if (!requestId) {
        console.warn('⚠️ [Kafka] No se encontró requestId en la respuesta');
        return;
      }

      const pending = this.pendingRequests.get(requestId);

      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(requestId);

        if (responseData.success) {
          pending.resolve(responseData.data);
        } else {
          pending.reject(new Error(responseData.error || 'Error en el servidor'));
        }
      } else {
        console.warn(`⚠️ [Kafka] No hay pending request para ${requestId}`);
      }
    } catch (error: any) {
      console.error('❌ Error procesando respuesta Kafka:', error.message);
    }
  }

  // ==================== API PÚBLICA ====================

  async request<T = any>(topic: string, type: string, data: any): Promise<T> {
    try {
      await this.ensureConnected();
    } catch (error: any) {
      throw new Error(`Error enviando petición: Kafka no disponible (${error.message})`);
    }

    const requestId = uuidv4();

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Timeout - No se recibió respuesta para ${requestId}`));
      }, 30000);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      this.producer.send({
        topic,
        messages: [
          {
            key: requestId,
            value: JSON.stringify({ requestId, type, data }),
          },
        ],
      }).catch((error) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(new Error(`Error enviando petición: ${error.message}`));
      });
    });
  }

  async send<T = any>(topic: string, data: any): Promise<T> {
    try {
      await this.ensureConnected();
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

  async emit<T>(
    topic: string,
    eventType: string,
    data: T,
    key?: string,
  ): Promise<boolean> {
    try {
      await this.ensureConnected();

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