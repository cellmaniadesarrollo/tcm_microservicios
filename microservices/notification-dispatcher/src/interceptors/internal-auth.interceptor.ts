// src/interceptors/internal-auth.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices'; // <-- CRUCIAL PARA RPC
import { Observable } from 'rxjs';

@Injectable()
export class InternalAuthInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const type = context.getType();

    // HTTP → solo healthcheck, nunca expuesto al exterior
    if (type === 'http') {
      return next.handle();
    }

    // RPC → toda petición DEBE venir del gateway con el token
    if (type === 'rpc') {
      const payload = context.switchToRpc().getData();

      // ── LOG DE DIAGNÓSTICO INTERNO ─────────────────────────────────────────
      console.log('📥 [InternalAuthInterceptor] Payload crudo recibido:', JSON.stringify(payload, null, 2));
      // ─────────────────────────────────────────────────────────────────────────

      const token = payload?.internalToken;

      // Validación rigurosa del secreto
      if (!token || token !== process.env.INTERNAL_SECRET) {
        console.log('❌ Petición no autorizada — no viene del gateway', {
          received: token ? 'Token Incorrecto' : 'undefined',
        });

        // Rompemos usando la excepción nativa de microservicios para que viaje por RabbitMQ
        throw new RpcException('Unauthorized: Token interno inválido o ausente');
      }

      return next.handle();
    }

    return next.handle();
  }
}