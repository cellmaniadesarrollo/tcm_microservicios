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

  // 2. Configurar el microservice RMQ
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBIT_URL || 'amqp://guest:guest@localhost:5672'],
      queue: 'realtime_orders_queue',
      queueOptions: {
        durable: true,
      },
      // prefetchCount: 1, // recomendado en producción
    },
  });

  // 3. ¡¡¡ ESTO ES LO QUE FALTABA !!!
  await app.startAllMicroservices();

  // 4. Iniciar el servidor HTTP + WebSocket
  await app.listen(3002);

  console.log('🚀 Realtime service corriendo en puerto 3002');
  console.log('📡 Microservice RMQ iniciado + Socket.IO con Redis');
}

bootstrap();