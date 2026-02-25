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
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        level: 'info', // niveles: fatal, error, warn, info, debug, trace
        transport: {
          target: 'pino-pretty', // 👈 formato "bonito" como Morgan
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            singleLine: true,
            ignore: 'pid,hostname',
          },
        },
      },
    })
  );
  // 👉 REGISTRO DE MULTIPART  
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB por archivo (ajusta según necesites)
      files: 10,                  // max 10 archivos por request
    },
  });
  // 👉 Habilita CORS
  await app.register(fastifyCors, {
    origin: ['http://localhost:4200'], // o '*', o un array de orígenes
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.getHttpAdapter().getInstance().register(fastifyStatic, {
    root: join(__dirname, '..', 'assets'),
    prefix: '/public/',
  });
  app.useGlobalInterceptors(new RpcToHttpInterceptor());
  // En producción: escuchar SOLO en localhost (Nginx maneja el exterior)
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const host = process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0';

  await app.listen(port, host);

  console.log(
    `🚀 Gateway corriendo en http://${host}:${port} (${process.env.NODE_ENV || 'development'})`
  );

  // Opcional: loguear la URL pública en prod
  if (process.env.NODE_ENV === 'production') {
    console.log(`   Accesible públicamente → https://ms.teamcellmania.com`);
  }
}
bootstrap();
