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
    return next.handle().pipe(
      catchError((err: any) => {
        console.log('DEBUG RPC ERROR recibido:', JSON.stringify(err, null, 2)); // ← log temporal para depurar

        // Caso principal: Excepción directa (NotFoundException, etc.) en RMQ
        // Llega con err.status (número) y err.message o err.response
        if (err && typeof err.status === 'number') {
          const status = err.status;
          let message = err.message || 'Error en el microservicio';
          let errorDetail = err.error || 'Error';

          // Si hay response anidado (muy común en RMQ)
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

        // Caso RpcException explícita
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
          // RpcException con string
          return throwError(() => new InternalServerErrorException(String(rpcResp)));
        }

        // Caso plano o envuelto
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

        // Fallback
        const fallbackMsg = err?.message || 'Error inesperado en el microservicio';
        return throwError(() => new InternalServerErrorException(fallbackMsg));
      }),
    );
  }
}