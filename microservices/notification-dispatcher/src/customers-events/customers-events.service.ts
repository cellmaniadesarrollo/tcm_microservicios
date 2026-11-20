import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerCache } from './entities/customer-cache.entity';
import { BillingDataCache } from './entities/billing-data-cache.entity';

@Injectable()
export class CustomersEventsService {
    constructor(
        @InjectRepository(CustomerCache) private readonly customerRepo: Repository<CustomerCache>,
        @InjectRepository(BillingDataCache) private readonly billingRepo: Repository<BillingDataCache>,
    ) { }

    /** Cliente replicado con contactos (para órdenes / notificaciones). */
    findCustomer(id: number) {
        return this.customerRepo.findOne({ where: { id }, relations: ['contacts'] });
    }

    /** Datos de facturación vinculados a un cliente. */
    findBillingByCustomer(customerId: number) {
        return this.billingRepo
            .createQueryBuilder('b')
            .where(':id = ANY(b.customer_ids)', { id: customerId })
            .andWhere('b.is_active = true')
            .getMany();
    }

    findBilling(id: string) {
        return this.billingRepo.findOne({ where: { id } });
    }
}