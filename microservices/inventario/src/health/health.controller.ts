// microservicio-inventario/src/health/health.controller.ts

import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller('health')
export class HealthController {
  // ✅ Especificar la conexión 'default'
  constructor(@InjectConnection('default') private readonly connection: Connection) {}

  @Get()
  check() {
    const state = this.connection.readyState;
    return {
      status: state === 1 ? 'ok' : 'error',
      mongodb: state === 1 ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      service: 'inventario-service',
    };
  }
}