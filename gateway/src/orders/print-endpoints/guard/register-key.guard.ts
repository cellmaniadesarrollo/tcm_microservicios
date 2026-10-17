import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class RegisterKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const sent = Buffer.from(String(req.headers['x-register-key'] ?? ''));
    const expected = Buffer.from(process.env.PRINT_SECRET ?? '');

    if (!expected.length || sent.length !== expected.length || !timingSafeEqual(sent, expected)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}