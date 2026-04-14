//src\legacy\legacy-jwt.strategy\legacy-jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LegacyJwtStrategy extends PassportStrategy(Strategy, 'legacy-jwt') {
    constructor(private readonly configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('LEGACY_JWT_SECRET')!,
        });
    }

    async validate(payload: any) {
        // Puedes agregar validaciones extras aquí si quieres
        console.log('Contenido del Token Decodificado:', payload);
        return payload;
    }
}