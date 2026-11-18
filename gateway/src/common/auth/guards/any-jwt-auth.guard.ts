import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AnyJwtAuthGuard implements CanActivate {
  private readonly jwt = new JwtService();

  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const header: string = req.headers['authorization'] ?? '';
    const [type, token] = header.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    const secrets = [
      this.config.get<string>('JWT_SECRET'),
      this.config.get<string>('LEGACY_JWT_SECRET'),
    ].filter((s): s is string => !!s);

    for (const secret of secrets) {
      try {
        req.user = this.jwt.verify(token, { secret });
        return true;
      } catch {
        // prueba con el siguiente secreto
      }
    }

    throw new UnauthorizedException('Token expirado o inválido');
  }
}