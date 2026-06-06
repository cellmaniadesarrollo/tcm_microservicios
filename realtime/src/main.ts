import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './adapters/redis-io.adapter';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Redis Adapter para WebSocket (Socket.IO + Redis)
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // 2. Configurar microservice RMQ para ÓRDENES
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBIT_URL || 'amqp://guest:guest@ms-notifications-rabbitmq:5672'],
      queue: 'realtime_orders_queue',
      queueOptions: { durable: true },
    },
  });

  // 3. Configurar microservice RMQ para TAREAS
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBIT_URL || 'amqp://guest:guest@ms-notifications-rabbitmq:5672'],
      queue: 'realtime_tasks_queue',  // ← AGREGAR ESTA
      queueOptions: { durable: true },
    },
  });

  // 4. Iniciar todos los microservicios
  await app.startAllMicroservices();

  // 5. Iniciar el servidor HTTP + WebSocket
  await app.listen(3002);

  console.log('🚀 Realtime service corriendo en puerto 3002');
  console.log('📡 Microservicios RMQ iniciados (orders + tasks) + Socket.IO con Redis');
}

bootstrap();