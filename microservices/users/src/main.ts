import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as morgan from 'morgan';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { InternalAuthInterceptor } from './interceptors/internal-auth.interceptor';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configurar microservicio
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
      queue: 'users_queue_sync', // ⬅️ Cola sincronizacion
      queueOptions: {
        durable: true
      },
      // Opciones adicionales recomendadas  
      persistent: true,
    },
  });

  app.use(morgan('dev'));
  app.useGlobalInterceptors(new InternalAuthInterceptor());

  if (process.env.NODE_ENV === 'development') {
    const config = new DocumentBuilder()
      .setTitle('Users API')
      .setDescription('Documentación de la API de Usuarios')
      .setVersion('1.0')
      .addTag('users')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document);
    console.log(`📚 Swagger disponible en http://localhost:3001/api-docs`);
  }

  // 👇 Esta línea ahora inicia correctamente el microservicio con el filtro activo
  await app.startAllMicroservices();

  // Iniciar también la app HTTP si la usas
  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Users corriendo en http://localhost:3001`);
}

bootstrap();
