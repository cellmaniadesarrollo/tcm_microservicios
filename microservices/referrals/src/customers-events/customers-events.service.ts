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
    if (!data?.id || !data?.companyId) return;

    // AJUSTA los nombres de campos al payload real del evento de clients
    const firstName = data.firstName ?? data.first_name ?? '';
    const secondName = data.secondName ?? data.second_name ?? null;
    const lastName = data.lastName ?? data.last_name ?? '';
    const secondLastName = data.secondLastName ?? data.second_last_name ?? null;

    await this.cache.save({
      customerId: String(data.id),
      companyId: String(data.companyId),
      firstName,
      secondName,
      lastName,
      secondLastName,
      searchText: normalize(
        [firstName, secondName, lastName, secondLastName].filter(Boolean).join(' '),
      ),
    });

    // Solo al crear el cliente (idempotente: si ya existe, no crea otro código)
    if (createProfile) {
      await this.profiles.ensureForCustomer(String(data.id), String(data.companyId));
    }

    // Idempotente: si ya existe, no crea otro código
    await this.profiles.ensureForCustomer(String(data.id), String(data.companyId));
  }
}