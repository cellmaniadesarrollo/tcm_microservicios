// src/legacy/legacy-auth/legacy-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LegacyAuthGuard extends AuthGuard('legacy-jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      console.log('LegacyAuthGuard rechazó:', info?.message ?? err);
    }
    return super.handleRequest(err, user, info, undefined as any);
  }
}