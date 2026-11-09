import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // TCP para que el gateway hable con este ms
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: Number(process.env.TCP_PORT ?? 4012),
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3012); // health
  console.log(`🚀 referrals — HTTP ${process.env.PORT ?? 3012} / TCP ${process.env.TCP_PORT ?? 4012}`);
}
bootstrap();