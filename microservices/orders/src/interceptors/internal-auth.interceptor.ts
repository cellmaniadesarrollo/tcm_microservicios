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
    const payload = context.switchToRpc().getData();
    const token = payload?.internalToken;

    if (token !== process.env.INTERNAL_SECRET) {
      throw new UnauthorizedException('Token interno inválido');
    }

    return next.handle();
  }
}
