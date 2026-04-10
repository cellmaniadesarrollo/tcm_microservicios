// src/interceptors/internal-auth.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
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
      const token = payload?.internalToken;

      if (token !== process.env.INTERNAL_SECRET) {
        console.log('❌ Petición no autorizada — no viene del gateway', {
          received: token ? '***' : 'undefined',
        });
        throw new UnauthorizedException('Token interno inválido');
      }

      return next.handle();
    }

    return next.handle();
  }
}
