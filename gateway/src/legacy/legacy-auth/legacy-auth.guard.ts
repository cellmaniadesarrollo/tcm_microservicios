//src\legacy\legacy-auth\legacy-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LegacyAuthGuard extends AuthGuard('legacy-jwt') { }