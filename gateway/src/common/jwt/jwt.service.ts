import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';

@Injectable()
export class JwtService {
  constructor(private readonly jwtService: NestJwtService) {}

  generateToken(payload: any, expiresIn: string | number) {
    return this.jwtService.sign(payload, { expiresIn });
  }

  verifyToken(token: string): any {
    return this.jwtService.verify(token);
  }
}