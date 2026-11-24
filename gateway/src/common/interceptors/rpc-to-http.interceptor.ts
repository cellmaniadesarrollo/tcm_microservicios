import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { RpcException } from '@nestjs/microservices';

const isHttpStatus = (n: unknown): n is number =>
  typeof n === 'number' && n >= 100 && n < 600;

@Injectable()
export class RpcToHttpInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RpcToHttpInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((err: any) => {
        this.logger.debug(`RPC error recibido: ${JSON.stringify(err)}`);

        // Si ya es una HttpException del propio gateway, se deja pasar tal cual
        if (err instanceof HttpException) {
          return throwError(() => err);
        }

        // 1) Formato estándar que envía toRpc() desde los microservicios:
        //    { statusCode: 400, message: '...', error: 'Bad Request' }
        if (err && isHttpStatus(err.statusCode)) {
          return throwError(() =>
            new HttpException(
              {
                statusCode: err.statusCode,
                message: err.message ?? 'Error en el microservicio',
                error: typeof err.error === 'string' ? err.error : 'Error',
              },
              err.statusCode,
            ),
          );
        }

        // 2) Excepción directa (NotFoundException, etc.) con err.status numérico
        if (err && isHttpStatus(err.status)) {
          const status = err.status;
          let message = err.message || 'Error en el microservicio';
          let errorDetail = typeof err.error === 'string' ? err.error : 'Error';

          if (err.response && typeof err.response === 'object') {
            message = err.response.message || message;
            errorDetail = err.response.error || errorDetail;
          }

          return throwError(() =>
            new HttpException({ statusCode: status, message, error: errorDetail }, status),
          );
        }

        // 3) RpcException explícita (cuando no viene deserializada)
        if (err instanceof RpcException) {
          const rpcResp = err.getError();
          if (typeof rpcResp === 'object' && rpcResp !== null) {
            const statusCode = (rpcResp as any).statusCode ?? (rpcResp as any).status;
            const code = isHttpStatus(statusCode) ? statusCode : 500;
            return throwError(() =>
              new HttpException(
                {
                  statusCode: code,
                  message: (rpcResp as any).message ?? 'Error RPC',
                  error: (rpcResp as any).error ?? 'Internal Error',
                },
                code,
              ),
            );
          }
          return throwError(() => new InternalServerErrorException(String(rpcResp)));
        }

        // 4) Payload anidado en response / error (objeto)
        const payload = err?.response ?? err?.error ?? err;
        if (payload && typeof payload === 'object') {
          const statusCode = payload.statusCode ?? payload.status;
          if (isHttpStatus(statusCode)) {
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

        // 5) Red de seguridad temporal: RpcException(string) de handlers que
        //    aún no usan toRpc() llegan como { status: 'error', message }.
        //    Se tratan como 400. Quitar cuando todos los microservicios usen toRpc().
        if (err?.status === 'error' && typeof err.message === 'string') {
          return throwError(() => new BadRequestException(err.message));
        }

        // Fallback
        const fallbackMsg = err?.message || 'Error inesperado en el microservicio';
        return throwError(() => new InternalServerErrorException(fallbackMsg));
      }),
    );
  }
}