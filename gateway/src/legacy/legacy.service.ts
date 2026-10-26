import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class LegacyService {
    private readonly logger = new Logger(LegacyService.name);

    constructor(
        @Inject('CUSTOMERS_SERVICE') private readonly customersService: ClientProxy,
        private readonly jwtService: JwtService,               // 🆕
    ) { }

    private resolveSigner(tokenData: any, signerToken?: string) {
        if (signerToken) {
            let s: any;
            try {
                s = this.jwtService.verify(signerToken, { secret: process.env.LEGACY_JWT_SECRET });
            } catch (e: any) {                                                              // 🆕
                this.logger.error(`verify falló: ${e?.name} - ${e?.message}`);               // 🆕
                this.logger.debug(`LEGACY_JWT_SECRET definido: ${!!process.env.LEGACY_JWT_SECRET}`); // 🆕
                throw new UnauthorizedException('Token de firma inválido o expirado');
            }

            this.logger.debug(`companyId firma: ${s.companyId} | sesión: ${tokenData?.dats?.companyId}`);
            if (s.companyId !== tokenData?.dats?.companyId)
                throw new UnauthorizedException('Firmante de otra empresa');
            if (s.sessionUserId !== String(tokenData?.id))
                throw new UnauthorizedException('Token de firma de otra sesión');

            return { id: String(s.signerId), username: s.signerName ?? null };
        }

        // Sin token de firma: firma con la sesión
        return { id: String(tokenData?.id), username: tokenData?.username ?? null };
    }

    async publishLegacyBilling(payload: any, tokenData: any, signerToken?: string) {
        this.logger.debug(`signerToken recibido: ${signerToken ? 'sí' : 'NO'}`);

        const message = {
            ...payload,
            internalToken: process.env.INTERNAL_SECRET,
            source: 'legacy',
            user: {
                id: tokenData?.id,
                name: tokenData?.username,
                companyId: tokenData?.dats?.companyId,
            },
            signer: this.resolveSigner(tokenData, signerToken),
        };
        return firstValueFrom(this.customersService.send('legacy_create_billing', message));
    }

    async publishLegacyBillingUpdate(id: string, payload: any, tokenData: any, signerToken?: string) {
        const message = {
            ...payload,
            internalToken: process.env.INTERNAL_SECRET,
            source: 'legacy',
            billingId: id,
            user: {
                id: tokenData?.id,
                name: tokenData?.username,
                companyId: tokenData?.dats?.companyId,
            },
            signer: this.resolveSigner(tokenData, signerToken),
        };
        return firstValueFrom(this.customersService.send('legacy_update_billing', message));
    }
}