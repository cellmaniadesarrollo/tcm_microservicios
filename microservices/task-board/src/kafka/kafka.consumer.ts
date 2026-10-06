import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload, logLevel } from 'kafkajs';

type TopicHandler = (eventType: string, data: any) => Promise<void>;

@Injectable()
export class KafkaConsumerService implements OnModuleDestroy {
  private consumer: Consumer;
  private readonly kafka: Kafka;
  private readonly handlers = new Map<string, TopicHandler>();

  private connected = false;
  private subscribed = false;
  private running = false;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'ms-taskboard-consumer',
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
      groupId: 'ms-taskboard-consumer-group',
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
   * Inicia el consumer. Retorna de inmediato y reintenta en segundo plano,
   * así un Kafka que arranca tarde no deja el consumer inactivo para siempre.
   */
  async start() {
    const topics = Array.from(this.handlers.keys());

    if (topics.length === 0) {
      console.warn('⚠️ No hay handlers registrados, consumer inactivo');
      return;
    }

    void (async () => {
      for (let i = 1; i <= 10; i++) {
        try {
          await this.connectAndRun(topics);
          return;
        } catch (error: any) {
          console.error(`❌ Kafka Consumer intento ${i}/10: ${error.message}`);
          await new Promise((r) => setTimeout(r, 3000 * i));
        }
      }
      console.error('❌ Kafka Consumer: no se pudo iniciar tras 10 intentos');
    })();
  }

  private async connectAndRun(topics: string[]) {
    if (!this.connected) {
      await this.consumer.connect();
      this.connected = true;
      console.log('✅ Kafka Consumer conectado - ms-taskboard');
    }

    if (!this.subscribed) {
      await this.consumer.subscribe({ topics });
      this.subscribed = true;
      console.log(`📥 Suscrito a topics: ${topics.join(', ')}`);
    }

    if (!this.running) {
      await this.consumer.run({
        autoCommit: false,
        eachMessage: async (payload: EachMessagePayload) => {
          await this.processMessage(payload);
        },
      });
      this.running = true;
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

      await this.consumer.commitOffsets([{
        topic,
        partition,
        offset: (BigInt(message.offset) + 1n).toString(),
      }]);
    } catch (error: any) {
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