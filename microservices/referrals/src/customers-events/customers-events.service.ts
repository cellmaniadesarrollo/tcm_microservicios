import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerCache } from './entities/customer-cache.entity';
import { ReferralProfilesService } from '../referral-profiles/referral-profiles.service';

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

@Injectable()
export class CustomersEventsService {
  constructor(
    @InjectRepository(CustomerCache)
    private readonly cache: Repository<CustomerCache>,
    private readonly profiles: ReferralProfilesService,
  ) {}

  async syncCustomer(data: any, createProfile: boolean) {
    const companyId = data?.companyId ?? data?.company?.id;
    if (!data?.id || !companyId) {
      console.warn('syncCustomer descartado, falta id o companyId:', data?.id);
      return;
    }

    const firstName = data.firstName ?? '';
    const secondName = data.secondName ?? null;
    const lastName = data.lastName ?? '';
    const secondLastName = data.secondLastName ?? null;
    const idNumber = data.idNumber ? String(data.idNumber).trim().toUpperCase() : null;

    await this.cache.save({
      customerId: String(data.id),
      companyId: String(companyId),
      firstName,
      secondName,
      lastName,
      secondLastName,
      searchText: normalize(
        [firstName, secondName, lastName, secondLastName, idNumber].filter(Boolean).join(' '),
      ),
    });

    if (createProfile) {
      await this.profiles.ensureForCustomer(
        String(data.id),
        String(companyId),
        { type: 'MANUAL', id: null },
      );
    }
  }
}