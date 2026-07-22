// ms-task-board/src/main.ts

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
// ❌ ELIMINAR: import { InternalAuthInterceptor } from './interceptor/internal-auth.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));
  
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe());
  
  // ❌ ELIMINAR: app.useGlobalInterceptors(new InternalAuthInterceptor());
  
  // Servidor TCP
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: 3000,
    },
  });
  
  await app.startAllMicroservices();
  
  const httpPort = 3001;
  await app.listen(httpPort, '0.0.0.0');
  
  console.log(`✅ HTTP server on port ${httpPort}`);
  console.log(`✅ TCP microservice on port 3000`);
}
bootstrap();