import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService, JwtSignOptions } from '@nestjs/jwt'; // Añade JwtSignOptions

@Injectable()
export class JwtService {
  constructor(private readonly jwtService: NestJwtService) { }

  // Cambiamos el segundo parámetro para que acepte las opciones oficiales
  generateToken(payload: any, expiresIn: JwtSignOptions['expiresIn']) {
    return this.jwtService.sign(payload, { expiresIn });
  }

  verifyToken(token: string): any {
    return this.jwtService.verify(token);
  }
}