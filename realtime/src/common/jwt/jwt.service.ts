//src\common\jwt\jwt.service.ts
import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';

@Injectable()
export class JwtService {
    constructor(private readonly jwtService: NestJwtService) { }

    /**
     * Verifica y decodifica un token JWT
     */
    verifyToken(token: string): any {
        return this.jwtService.verify(token);
    }
}