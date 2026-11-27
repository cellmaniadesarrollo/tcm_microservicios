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
      { rawBody: true },
    );

    // RabbitMQ - Cola durable para sincronización de ventas, stock y catálogo
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
        queue: process.env.SHOPIFY_RMQ_QUEUE || 'shopify_sync_queue',
        queueOptions: { durable: true },
        persistent: true,
      },
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Excluir webhooks públicos de Shopify de la validación de cabecera interna
    const internalAuth = new InternalAuthInterceptor();
    app.useGlobalInterceptors({
      intercept(context, next) {
        const req = context.switchToHttp().getRequest<{ url?: string }>();
        if (req?.url?.startsWith('/webhooks/shopify')) {
          return next.handle();
        }
        return internalAuth.intercept(context, next);
      },
    });

    await app.startAllMicroservices();
    console.log('✅ Microservicio RabbitMQ (shopify-sync) iniciado');

    const port = Number(process.env.PORT) || 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`✅ NestJS Fastify escuchando en 0.0.0.0:${port}`);
  } catch (err) {
    console.error('❌ Error en bootstrap:', err);
    process.exit(1);
  }
}

bootstrap();