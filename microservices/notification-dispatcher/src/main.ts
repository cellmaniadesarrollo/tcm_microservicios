import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { InternalAuthInterceptor } from './interceptors/internal-auth.interceptor';
import * as util from 'util';
// ── Silenciar ruido interno (Nivel Sistema Operativo / Proceso) ───────────────
const BAILEYS_NOISE = [
  'Closing session',
  'SessionEntry',
  'chainKey',
  'registrationId',
  'currentRatchet',
  'signedKeyId',
  'ephemeralKeyPair',
  'rootKey',
  'pendingPreKey'
];

// Guardamos la función original de escritura en la terminal
const originalWrite = process.stdout.write.bind(process.stdout);

// Redefinimos la escritura estándar
// @ts-ignore
process.stdout.write = (chunk: any, encoding?: any, callback?: any) => {
  // Convertimos el chunk (que suele ser un Buffer o String) a texto plano
  const logString = typeof chunk === 'string' ? chunk : chunk.toString('utf8');

  // Si contiene alguna de las palabras clave de Baileys, lo ignoramos por completo
  if (BAILEYS_NOISE.some(pattern => logString.includes(pattern))) {
    // Si requiere un callback para no congelar el stream, lo ejecutamos de forma segura
    if (typeof callback === 'function') callback();
    return true;
  }

  // Si está limpio, permitimos que se imprima normalmente
  return originalWrite(chunk, encoding, callback);
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