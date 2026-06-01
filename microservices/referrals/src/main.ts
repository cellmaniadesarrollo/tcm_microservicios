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

    // ── 2. Conectar el microservicio de RabbitMQ ──
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
        queue: 'referrals_queue',
        queueOptions: { durable: true },
        persistent: true,
      },
    });

    // ── 3. Interceptor global y microservicios ──
    app.useGlobalInterceptors(new InternalAuthInterceptor());
    await app.startAllMicroservices();
    console.log('✅ Microservicios RabbitMQ iniciados');

    // ── 4. Iniciar Fastify en el puerto configurado ──
    const port = process.env.PORT ?? 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`✅ NestJS Fastify escuchando en 0.0.0.0:${port}`);

  } catch (err) {
    console.error('❌ Error en bootstrap:', err);
    process.exit(1);
  }
}

bootstrap();