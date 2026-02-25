import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class RpcToHttpInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // ← SOLO ESTA LÍNEA NUEVA (o dos si quieres más claridad)
    if (context.getType() !== 'rpc') {
      return next.handle(); // ← pasa directo si es HTTP, WS, etc.
    }

    // Todo el resto del código queda exactamente igual ↓
    return next.handle().pipe(
      catchError((err: any) => {
        console.log('DEBUG RPC ERROR recibido:', JSON.stringify(err, null, 2));

        if (err && typeof err.status === 'number') {
          const status = err.status;
          let message = err.message || 'Error en el microservicio';
          let errorDetail = err.error || 'Error';

          if (err.response && typeof err.response === 'object') {
            message = err.response.message || message;
            errorDetail = err.response.error || errorDetail;
          }

          return throwError(() =>
            new HttpException(
              {
                statusCode: status,
                message,
                error: errorDetail,
              },
              status,
            ),
          );
        }

        if (err instanceof RpcException) {
          const rpcResp = err.getError();
          if (typeof rpcResp === 'object' && rpcResp !== null) {
            const statusCode = (rpcResp as any).statusCode ?? (rpcResp as any).status ?? 500;
            return throwError(() =>
              new HttpException(
                {
                  statusCode,
                  message: (rpcResp as any).message ?? 'Error RPC',
                  error: (rpcResp as any).error ?? 'Internal Error',
                },
                statusCode,
              ),
            );
          }
          return throwError(() => new InternalServerErrorException(String(rpcResp)));
        }

        const payload = err?.response ?? err?.error ?? err;
        if (payload && typeof payload === 'object' && payload !== null) {
          const statusCode = payload.statusCode ?? payload.status ?? 500;
          if (typeof statusCode === 'number' && statusCode >= 100 && statusCode < 600) {
            return throwError(() =>
              new HttpException(
                {
                  statusCode,
                  message: payload.message ?? 'Error desconocido',
                  error: payload.error ?? 'Internal Error',
                },
                statusCode,
              ),
            );
          }
        }

        const fallbackMsg = err?.message || 'Error inesperado en el microservicio';
        return throwError(() => new InternalServerErrorException(fallbackMsg));
      }),
    );
  }
}