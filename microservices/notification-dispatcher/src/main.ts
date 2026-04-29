import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { InternalAuthInterceptor } from './interceptors/internal-auth.interceptor';

async function bootstrap() {
  try {
    // ── 1. Crear la aplicación NestJS con Fastify ──
    // Usamos el puerto 3001 para diferenciarlo del reporting-hub
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter()
    );

    // ── 2. Conectar Microservicio RabbitMQ (Eventos de órdenes) ──
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
        queue: 'notifications_queue', // Cola específica para este MS
        queueOptions: { durable: true }, // Durable true para no perder notificaciones
        persistent: true,
      },
    });

    // ── 3. Conectar Microservicio Kafka (Sincronización de réplicas) ──
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'notification-dispatcher',
          brokers: (process.env.KAFKA_BOOTSTRAP_SERVERS || 'kafka:9092').split(','),
        },
        consumer: {
          groupId: 'notifications-group-id', // ID de grupo único para este servicio
        },
      },
    });

    // ── 4. Interceptor global y arranque de Microservicios ──
    // Mantengo tu interceptor de auth interna por seguridad
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