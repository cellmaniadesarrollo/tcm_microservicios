// microservices/notifications/src/main.ts
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    // ── 1. Crear la aplicación NestJS con Fastify ──
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({ logger: true })
    );

    // ── 2. Conectar microservicio TCP para RPC (Gateway) ──
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: 3003,  // ← Puerto TCP para RPC
      },
    });

    // ── 3. Conectar el microservicio de RabbitMQ ──
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672'],
        queue: 'notifications_queue',
        queueOptions: { durable: true },
        persistent: true,
        noAck: false,
      },
    });

    // ── 4. Iniciar microservicios ──
    await app.startAllMicroservices();
    console.log('✅ Microservicio de notificaciones iniciado');
    console.log('   - TCP RPC: puerto 3002');
    console.log('   - RabbitMQ: notifications_queue');

    // ── 5. Iniciar Fastify en el puerto 3010 (HTTP) ──
    await app.listen(3010, '0.0.0.0');
    console.log('✅ NestJS Fastify escuchando en 0.0.0.0:3010');

  } catch (err) {
    console.error('❌ Error en bootstrap:', err);
    process.exit(1);
  }
}

bootstrap();