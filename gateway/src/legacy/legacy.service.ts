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
        const message = {
            ...payload,                          // payload primero, para que no pise a user
            internalToken: process.env.INTERNAL_SECRET,
            source: 'legacy',
            user: {
                id: tokenData?.id,               // ObjectId del sistema de órdenes
                name: tokenData?.username,
                companyId: tokenData?.dats?.companyId,
            },
        };
        return firstValueFrom(this.customersService.send('legacy_create_billing', message));
    }

    async publishLegacyBillingUpdate(id: string, payload: any, tokenData: any) {
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
        };
        return firstValueFrom(this.customersService.send('legacy_update_billing', message));
    }
    private readonly logger = new Logger(LegacyService.name);
}