import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { join } from 'path';
import { RpcToHttpInterceptor } from './common/interceptors/rpc-to-http.interceptor';
import multipart from '@fastify/multipart';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        level: isProduction ? 'info' : 'debug', // menos verbose en prod
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: !isProduction,           // sin colores en prod (logs más limpios)
            translateTime: 'yyyy-mm-dd HH:MM:ss',
            singleLine: true,
            ignore: 'pid,hostname',
          },
        },
      },
      // Muy importante cuando hay proxy delante (Nginx, ALB, CloudFront, etc.)
      trustProxy: true,
    }),
  );

  // Multipart (subida de archivos)
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MiB
      files: 10,
    },
  });

  // CORS – muy importante diferenciar dev vs prod
  await app.register(fastifyCors, {
    origin: isProduction
      ? [
        'https://tu-frontend.com',           // ← cámbialo por el dominio real
        'https://www.tu-frontend.com',
        // 'https://ms.teamcellmania.com',   // si el frontend y api están en mismo dominio
      ]
      : ['http://localhost:4200', 'http://localhost:3000'], // para dev
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Pipes globales
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,           // ← recomendado: convierte query params y body a tipos
      forbidUnknownValues: true,
    }),
  );

  // Archivos estáticos (si los usas)
  app.getHttpAdapter().getInstance().register(fastifyStatic, {
    root: join(__dirname, '..', 'assets'),
    prefix: '/public/',
    decorateReply: false, // buena práctica con Fastify
  });

  // Interceptor global
  app.useGlobalInterceptors(new RpcToHttpInterceptor());

  // Puerto y host según entorno
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const host = isProduction ? '127.0.0.1' : '0.0.0.0';

  await app.listen(port, host);

  const protocol = isProduction ? 'http' : 'http'; // en prod es http interno
  console.log(`🚀 Gateway corriendo en ${protocol}://${host}:${port} (${process.env.NODE_ENV || 'development'})`);

  if (isProduction) {
    console.log(`   Accesible públicamente → https://ms.teamcellmania.com`);
  }
}

bootstrap().catch((err) => {
  console.error('Error al iniciar el gateway:', err);
  process.exit(1);
});