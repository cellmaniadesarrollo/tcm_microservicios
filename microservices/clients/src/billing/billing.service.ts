import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Billing } from './entities/billing.entity';
import { Customer } from '../customers/entities/customer.entity';
import { IdentificationType } from '../catalogs/entities/identificationType.entity';

@Injectable()
export class BillingService {
    constructor(
        @InjectRepository(Billing)
        private billingRepo: Repository<Billing>,

        @InjectRepository(Customer)
        private customerRepo: Repository<Customer>,

        @InjectRepository(IdentificationType)
        private idTypeRepo: Repository<IdentificationType>
    ) { }

    async create(data: any) {
    
               const customer = await this.customerRepo.findOne({
            where: {
                id: data.customerId,
                company: {
                    id: data.user.companyId,
                },
            },
        });
        
        if (!customer) throw new NotFoundException('Customer not found');

        const idType = await this.idTypeRepo.findOne({ where: { id: data.identificationTypeId } });
        if (!idType) throw new NotFoundException('Identification type not found');

        const billing = this.billingRepo.create({
            customer,
            businessName: data.businessName,
            identification: data.identification,
            identificationType: idType,
            billingAddress: data.billingAddress,
            billingPhone: data.billingPhone,
            billingEmail: data.billingEmail,
        });

        return this.billingRepo.save(billing); 
 

    }

    async update(id: number, updates: any  ) {
        const billing = await this.billingRepo.findOne({ where: { id } });
 
        if (!billing) throw new NotFoundException('Billing record not found');

        if (updates.identificationTypeId) {
            const newType = await this.idTypeRepo.findOne({ where: { id: updates.identificationTypeId } });
            if (!newType) throw new NotFoundException('Identification type not found');
            billing.identificationType = newType;
        }

        Object.assign(billing, updates);
        return this.billingRepo.save(billing);
    }

}
