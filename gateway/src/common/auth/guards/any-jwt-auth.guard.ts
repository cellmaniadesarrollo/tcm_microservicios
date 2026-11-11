import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AnyJwtAuthGuard implements CanActivate {
  private readonly jwt = new JwtService();

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
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