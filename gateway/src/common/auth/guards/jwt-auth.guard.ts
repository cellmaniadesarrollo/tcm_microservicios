import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '../../jwt/jwt.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * =====================================================
 * JWT AUTH GUARD – VALIDACIÓN DE TOKEN
 * =====================================================
 *
 * Primer guard en ejecutarse. Verifica que la petición
 * incluya un token JWT válido en el header Authorization.
 *
 * -----------------------------------------------------
 * FLUJO DE VALIDACIÓN
 * -----------------------------------------------------
 *
 * 1️⃣ Detecta si el endpoint tiene @Public()
 *    - Si es público → deja pasar sin validar nada
 *
 * 2️⃣ Lee el header Authorization
 *    - Formato esperado: Bearer <token>
 *    - Si no existe → UnauthorizedException
 *
 * 3️⃣ Verifica el token con JwtService
 *    - Si es válido → inyecta el payload en request.user
 *    - Si expiró o es inválido → UnauthorizedException
 *
 * -----------------------------------------------------
 * ERRORES POSIBLES
 * -----------------------------------------------------
 *
 *  401 - 'Token no enviado'     → falta el header
 *  401 - 'Token inválido'       → formato incorrecto
 *  401 - 'Token expirado o inválido' → falla la verificación
 *
 * -----------------------------------------------------
 * USO
 * -----------------------------------------------------
 *
 *  // Se aplica automáticamente a través de @Auth()
 *  // No se usa directamente en los controladores
 *
 * =====================================================
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) { }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) throw new UnauthorizedException('Token no enviado');

    const token = authHeader.split(' ')[1];
    if (!token) throw new UnauthorizedException('Token inválido');

    try {
      const payload = this.jwtService.verifyToken(token);
      request.user = payload;
      return true;
    } catch (err) {
      throw new UnauthorizedException('Token expirado o inválido');
    }
  }
}