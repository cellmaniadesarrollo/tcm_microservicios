import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { InternalAuthInterceptor } from './interceptors/internal-auth.interceptor';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  try {
    // ── 1. Crear la aplicación NestJS con Fastify ──
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter()
    );

    // ── 2. Queue principal (eventos HTTP / gateway) ──
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
        queue: 'reports_queue',
        queueOptions: { durable: false },
        persistent: false,
      },
    });

    // ── 3. Queue de sincronización bulk (ms-orders → reporting-hub) ──
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
        queue: 'reporting_hub_queue_sync',
        queueOptions: { durable: true },
        persistent: true,
      },
    });

    // ── 4. Interceptor global y microservicios ──
    app.useGlobalInterceptors(new InternalAuthInterceptor());
    await app.startAllMicroservices();
    console.log('✅ Microservicios RabbitMQ iniciados');

    // ── 5. Iniciar Fastify en el puerto 3000 (único servidor) ──
    await app.listen(3000, '0.0.0.0');
    console.log('✅ NestJS Fastify escuchando en 0.0.0.0:3000');

  } catch (err) {
    console.error('❌ Error en bootstrap:', err);
    process.exit(1);
  }
}

bootstrap();