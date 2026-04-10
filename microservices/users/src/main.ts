import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { InternalAuthInterceptor } from './interceptors/internal-auth.interceptor';
import * as http from 'http';

async function bootstrap() {
  try {
    // ── 1. Health server temporal ──
    const healthServer = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => healthServer.listen(3000, '0.0.0.0', resolve));
    console.log('✅ Health server escuchando en 0.0.0.0:3000');

    // ── 2. NestJS con Express ──
    const app = await NestFactory.create(AppModule);

    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
        queue: 'users_queue',
        queueOptions: { durable: false },
      },
    });

    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBIT_URL || 'amqp://rabbitmq:5672'],
        queue: 'users_queue_sync',
        queueOptions: { durable: true },
        persistent: true,
      },
    });

    app.useGlobalInterceptors(new InternalAuthInterceptor());
    await app.startAllMicroservices();
    console.log('✅ Microservicios RabbitMQ iniciados');

    // ── 3. Cierra temporal y Express toma el puerto ──
    await new Promise<void>((resolve, reject) =>
      healthServer.close((err) => (err ? reject(err) : resolve()))
    );

    await app.listen(3000, '0.0.0.0');
    console.log('✅ NestJS Express escuchando en 0.0.0.0:3000');

  } catch (err) {
    console.error('❌ Error en bootstrap:', err);
    process.exit(1);
  }
}

bootstrap();