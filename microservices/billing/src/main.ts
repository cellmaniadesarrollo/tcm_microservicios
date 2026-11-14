import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';


import { AppModule } from './app.module';
import { InternalAuthInterceptor } from './interceptors/internal-auth.interceptor';


async function bootstrap() {
  try {
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
    );

    // RabbitMQ
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
        queue: 'billing_core_queue',
        queueOptions: { durable: false },
        persistent: false,
      },
    });

    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
        queue: 'billing_core_queue_sync',
        queueOptions: { durable: true },
        persistent: true,
      },
    });

    // Kafka (pendiente)

    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(new InternalAuthInterceptor());

    await app.startAllMicroservices();
    console.log('✅ Microservicios RabbitMQ iniciados (ms-billing)');

    await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
    console.log(`✅ ms-billing (NestJS + Fastify) escuchando en 0.0.0.0:${process.env.PORT ?? 3000}`);
  } catch (err) {
    console.error('❌ Error en bootstrap:', err);
    process.exit(1);
  }
}

bootstrap();