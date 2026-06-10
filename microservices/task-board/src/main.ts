import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';  // ← AGREGAR

async function bootstrap() {
  // Servidor HTTP (REST) para imágenes
  const app = await NestFactory.create(AppModule);
  
  // ✅ AUMENTAR LÍMITE DE TAMAÑO PARA IMÁGENES BASE64
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));
  
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe());
  
  // Servidor TCP (para comunicación con gateway)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: 3000,  // TCP en puerto 3000
    },
  });
  
  await app.startAllMicroservices();
  
  // HTTP en puerto 3001 (diferente)
  const httpPort = 3001;
  await app.listen(httpPort, '0.0.0.0');
  
  console.log(`✅ HTTP server on port ${httpPort}`);
  console.log(`✅ TCP microservice on port 3000`);
}
bootstrap();