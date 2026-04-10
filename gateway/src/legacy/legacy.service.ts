// src/legacy/legacy.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class LegacyService {
    constructor(
        @Inject('CUSTOMERS_SERVICE') private readonly customersService: ClientProxy,
    ) { }

    async publishLegacyBilling(payload: any, tokenData: any) {
        this.logger.log(`🔐 Legacy billing desde compañía: ${tokenData?.dats?.companyId}`);

        const message = {
            internalToken: process.env.INTERNAL_SECRET,
            source: 'legacy',
            user: {
                companyId: tokenData?.dats?.companyId,
                name: tokenData?.dats?.name,
                email: tokenData?.dats?.email,
            },
            ...payload,
        };

        // 👇 send en lugar de emit — espera respuesta
        return firstValueFrom(
            this.customersService.send('legacy_create_billing', message),
        );
    }

    private readonly logger = new Logger(LegacyService.name);
}