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

    // ── 2. Conectar microservicio TCP para comunicación directa con Gateway ──
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: parseInt(process.env.TCP_PORT || '3010', 10),
      },
    });

    // ── 3. Conectar microservicio RabbitMQ para eventos de órdenes ──
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
        queue: 'notifications_queue',
        queueOptions: { durable: true },
        persistent: true,
        noAck: false,
      },
    });

    // ── 4. Iniciar todos los microservicios ──
    await app.startAllMicroservices();
    console.log('✅ Microservicios de notificaciones iniciados:');
    console.log(`   - TCP: puerto ${process.env.TCP_PORT || 3010}`);
    console.log('   - RabbitMQ: notifications_queue');

    // ── 5. Iniciar servidor HTTP (opcional, para health checks) ──
    const httpPort = parseInt(process.env.HTTP_PORT || '3066', 10);
    await app.listen(httpPort, '0.0.0.0');
    console.log(`✅ HTTP Health check listening on port ${httpPort}`);

  } catch (err) {
    console.error('❌ Error en bootstrap:', err);
    process.exit(1);
  }
}

bootstrap();