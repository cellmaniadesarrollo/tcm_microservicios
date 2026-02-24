import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { InternalAuthInterceptor } from './interceptors/internal-auth.interceptor';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );
  // Configurar microservicio RabbitMQ 
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBIT_URL||'amqp://rabbitmq:5672'],
      queue: 'customers_queue', // ⬅️ Cola gateway
      queueOptions: {
        durable: false
      }, 
      // Opciones adicionales recomendadas  
      persistent: false,
    },
  });
   app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBIT_URL||'amqp://rabbitmq:5672'],
      queue: 'customers_queue_sync', // ⬅️ Cola sincronizacion
      queueOptions: {
        durable: true
      }, 
      // Opciones adicionales recomendadas  
      persistent: true,
    },
  });
  app.useGlobalInterceptors(new InternalAuthInterceptor());
  await app.startAllMicroservices();
  await app.listen(3000, '0.0.0.0');
  console.log('🚀 Microservicio Clientes  en http://localhost:3004');
}
bootstrap(); 
