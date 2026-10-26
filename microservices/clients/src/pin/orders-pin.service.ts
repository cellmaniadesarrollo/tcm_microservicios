import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

export interface Signer {
  id: string;
  username: string;
}

/**
 * Valida el PIN contra el MS `users` (sistema de ÓRDENES).
 * Este MS no guarda ningún hash de PIN: solo pregunta y recibe quién firma.
 *
 * Los usuarios de FACTURACIÓN no pasan por aquí: ese sistema valida el PIN
 * en su propio backend (Mongo) antes de llamar a `clients`.
 */
@Injectable()
export class OrdersPinService {
  private readonly logger = new Logger(OrdersPinService.name);

  constructor(
    @Inject('USERS_SERVICE') private readonly usersClient: ClientProxy,
  ) {}

  private async send<T>(cmd: string, payload: Record<string, any>): Promise<T> {
    try {
      return await firstValueFrom(
        this.usersClient
          .send<T>({ cmd }, { ...payload, internalToken: process.env.INTERNAL_SECRET })
          .pipe(timeout(8000)),
      );
    } catch (e: any) {
      if (e instanceof RpcException) throw e;

    if (e?.name === 'TimeoutError') {
      this.logger.error(`Timeout esperando respuesta de users para cmd=${cmd}`);
      throw new RpcException({
        statusCode: 504,
        message: 'No se pudo validar el PIN. Intenta de nuevo.',
      });
    }

      // Conserva el código original (401 PIN incorrecto, 423 bloqueo, etc.)
      throw new RpcException({
        statusCode: e?.statusCode ?? e?.status ?? 500,
        message: e?.message ?? 'Error validando el PIN',
      });
    }
  }

  /**
   * Devuelve quién firma la operación.
   * - Cuenta sin PIN obligatorio → firma la propia sesión.
   * - Cuenta con PIN obligatorio → el PIN identifica al firmante.
   */
  async resolveSigner(user: any, pin?: string): Promise<Signer> {
    const sessionUserId = String(user?.sub ?? user?.userId ?? user?.id ?? '');
    const sessionCompanyId = String(user?.companyId ?? '');

    if (!sessionUserId || !sessionCompanyId) {
      throw new RpcException({ statusCode: 401, message: 'Sesión no válida' });
    }

    const required = await this.send<boolean>('pin_is_required', { sessionUserId });

    if (!required) {
      return {
        id: sessionUserId,
        username: user?.username ?? user?.name ?? user?.email ?? sessionUserId,
      };
    }

    if (!pin) {
      throw new RpcException({ statusCode: 400, message: 'El PIN es obligatorio.' });
    }

    const raw: any = await this.send<any>('pin_validate', {
      pin,
      sessionUserId,
      sessionCompanyId,
    });

    // Tolera distintas formas de respuesta del MS users
    const id = raw?.id ?? raw?.userId ?? raw?._id ?? raw?.sub ?? raw?.user?.id ?? raw?.user?._id;
    const username =
      raw?.username ?? raw?.name ?? raw?.email ?? raw?.user?.username ?? raw?.user?.name;

    if (!id) {
      // Solo se registran las CLAVES, nunca el PIN ni valores
      this.logger.error(
        `pin_validate devolvió una forma inesperada. Claves: ${Object.keys(raw ?? {}).join(', ') || '(vacío)'}`,
      );
      throw new RpcException({
        statusCode: 500,
        message: 'No se pudo identificar al firmante.',
      });
    }

    return { id: String(id), username: String(username ?? id) };
  }
}