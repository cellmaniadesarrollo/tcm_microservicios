import { Injectable } from '@nestjs/common';
import { Resource } from './entities/resource.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Feature } from './entities/feature.entity';
import { SubscriptionStatus } from './entities/subscription-status.entity';
import { BillingCycle } from './entities/billing-cycle.entity';

@Injectable()
export class CatalogsService {
      

  constructor(
    @InjectRepository(BillingCycle)
    private readonly billingCycleRepo: Repository<BillingCycle>,

    @InjectRepository(SubscriptionStatus)
    private readonly subscriptionStatusRepo: Repository<SubscriptionStatus>,

    @InjectRepository(Feature)
    private readonly featureRepo: Repository<Feature>,

    @InjectRepository(Resource)
    private readonly resourceRepo: Repository<Resource>,
  ) {}

  async onModuleInit() {
    try {
        
            await this.seedBillingCycles();
    await this.seedSubscriptionStatuses();
    await this.seedFeatures();
    await this.seedResources();
    } catch (error) {
        console.log(error)
    }

  }

  // -----------------------------

  private async seedBillingCycles() {
    if (await this.billingCycleRepo.count()) return;

    await this.billingCycleRepo.save([
      { code: 'monthly', name: 'Monthly' },
      { code: 'yearly', name: 'Yearly' },
    ]);

    console.log('BillingCycle catalog seeded');
  }

  private async seedSubscriptionStatuses() {
    if (await this.subscriptionStatusRepo.count()) return;

    await this.subscriptionStatusRepo.save([
      { code: 'active', name: 'Active' },
      { code: 'suspended', name: 'Suspended' },
      { code: 'expired', name: 'Expired' },
    ]);

    console.log('SubscriptionStatus catalog seeded');
  }

  private async seedFeatures() {
    if (await this.featureRepo.count()) return;

await this.featureRepo.save([
  { code: 'orders', name: 'MS Orders' },
  { code: 'inventory', name: 'MS Inventory' },
  { code: 'billing', name: 'MS Billing' },
  { code: 'reports', name: 'MS Reports' },
  { code: 'subscriptions', name: 'MS Subscriptios' },
  { code: 'all', name: 'All Features' }
]); 
 
    console.log('Feature catalog seeded');
  }

  private async seedResources() {
    if (await this.resourceRepo.count()) return;

    await this.resourceRepo.save([
      { code: 'users', name: 'Users' },
      { code: 'branches', name: 'Branches' },
    ]);

    console.log('Resource catalog seeded');
  }
}
