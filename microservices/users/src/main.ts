// users/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { InternalAuthInterceptor } from './interceptors/internal-auth.interceptor';
import { KafkaListenersOrchestrator } from './kafka/kafka-listeners.orchestrator';
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

    // Conectar TCP
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: 3001,
      },
    });

    app.useGlobalInterceptors(new InternalAuthInterceptor());

    // ✅ Forzar ejecución del orchestrator
    const orchestrator = app.get(KafkaListenersOrchestrator);
    await orchestrator.onModuleInit();

    // ✅ Iniciar todos los microservicios
    await app.startAllMicroservices();
    console.log('✅ Microservicios iniciados (TCP:3001)');

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