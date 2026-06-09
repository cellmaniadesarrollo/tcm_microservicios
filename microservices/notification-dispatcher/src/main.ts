import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { InternalAuthInterceptor } from './interceptors/internal-auth.interceptor';

// ── Silenciar ruido interno de Baileys ────────────────────────────────────────
const BAILEYS_NOISE = [
  'Closing session',
  'SessionEntry',
  'chainKey',
  'registrationId',
  'currentRatchet',
  'signedKeyId',
];

const _consoleLog = console.log.bind(console);

console.log = (...args: any[]) => {
  // Convertimos todos los argumentos a un solo string para buscar los patrones
  const completeLogLine = args
    .map(arg => {
      try {
        if (typeof arg === 'string') return arg;
        // Usamos una inspección simple para evitar errores de JSON.stringify con Buffers/Circular
        return Object.keys(arg || {}).join(' ');
      } catch {
        return '';
      }
    })
    .join(' ');

  // Si el log contiene alguno de los ruidos, lo ignoramos por completo
  if (BAILEYS_NOISE.some(pattern => completeLogLine.includes(pattern))) {
    return;
  }

  _consoleLog(...args);
};
// ─────────────────────────────────────────────────────────────────────────────

async function bootstrap() {
  try {
    // ── 1. Crear la aplicación NestJS con Fastify ──
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
    );

    // ── 2. Conectar Microservicio RabbitMQ (Eventos de órdenes) ──
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
        queue: 'notifications_dispatcher_queue',
        queueOptions: { durable: true },
        persistent: true,
      },
    });

    // ── 3. Conectar Microservicio Kafka (Sincronización de réplicas) ──
    // app.connectMicroservice<MicroserviceOptions>({
    //   transport: Transport.KAFKA,
    //   options: {
    //     client: {
    //       clientId: 'notification-dispatcher',
    //       brokers: (process.env.KAFKA_BOOTSTRAP_SERVERS || 'kafka:9092').split(','),
    //     },
    //     consumer: {
    //       groupId: 'notifications-group-id',
    //     },
    //   },
    // });

    // ── 4. Interceptor global y arranque de Microservicios ──
    app.useGlobalInterceptors(new InternalAuthInterceptor());

    await app.startAllMicroservices();
    console.log('✅ Microservicios RabbitMQ y Kafka iniciados');

    // ── 5. Iniciar Fastify en el puerto 3001 ──
    const port = 3001;
    await app.listen(port, '0.0.0.0');
    console.log(`✅ MS Notification Dispatcher escuchando en 0.0.0.0:${port}`);

  } catch (err) {
    console.error('❌ Error en bootstrap del Dispatcher:', err);
    process.exit(1);
  }
}

bootstrap();