import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, '..', 'certs', 'server.key')),
    cert: fs.readFileSync(path.join(__dirname, '..', 'certs', 'server.pem')),
  };

  const app = await NestFactory.create(AppModule, { httpsOptions });

  app.enableCors({
    origin: '*',  // Cambia por tu frontend real (o '*' para pruebas)
    methods: 'GET,POST,OPTIONS',
    credentials: true,
  });

  const PORT = 56789;
  await app.listen(PORT, '0.0.0.0');
  console.log(`Servicio de impresión HTTPS local corriendo en https://localhost:${PORT}`);
}
// "ip": "192.168.10.161",
// "ip": "192.168.0.101", 
bootstrap();