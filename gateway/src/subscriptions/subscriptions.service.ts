import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SubscriptionsService {
     constructor(
    @Inject('SUBSCRIPTION_SERVICE')
    private readonly client: ClientProxy,
  ) {}

  validateCompanySubscription(companyId: string) {
    return firstValueFrom(
      this.client.send(
        { cmd: 'validate_company_subscription' },
        {
          companyId,
          internalToken: process.env.INTERNAL_SECRET,
        },
      ),
    );
  }
  validateCompanyUserLimit(companyId: string) {
    return firstValueFrom(
      this.client.send(
        { cmd: 'validate_company_user_limit' },
        {
          companyId,
          internalToken: process.env.INTERNAL_SECRET,
        },
      ),
    );
  }
}
