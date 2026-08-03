import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { CustomerBillingData } from '../entities/customer-billing-data.entity';

const logger = new Logger('CustomerPersonalDataBackfill');

/**
 * BLINDAJE HISTÓRICO — se ejecuta UNA sola vez, en el onModuleInit del BillingService.
 *
 * Recorre los customers que tienen gender o birthDate en null, busca su BillingData
 * vinculado (prioriza el marcado como isDefault) y completa lo que falte.
 *
 * No se usa en los flujos normales (create / createFromLegacy / updateFromLegacy):
 * esos métodos ya resuelven gender/birthDate de forma inline en cada operación.
 * Este helper es solo para reparar el histórico dañado antes del fix, y sirve como
 * red de seguridad si algún registro viejo se escapó.
 *
 * Es idempotente: correrlo varias veces no hace daño, solo toca lo que sigue faltando.
 */
export async function backfillMissingCustomerPersonalData(
    customerRepo: Repository<Customer>,
    pivotRepo: Repository<CustomerBillingData>,
): Promise<void> {
    logger.log('Iniciando backfill de gender/birthDate en customers...');

    const customers = await customerRepo
        .createQueryBuilder('c')
        .leftJoinAndSelect('c.gender', 'gender')
        .where('gender.id IS NULL')
        .orWhere('c.birthDate IS NULL')
        .getMany();

    if (!customers.length) {
        logger.log('No hay customers pendientes de backfill.');
        return;
    }

    logger.log(`Customers candidatos a backfill: ${customers.length}`);
    let updated = 0;

    for (const customer of customers) {
        const link = await pivotRepo.findOne({
            where: { customer: { id: customer.id } },
            relations: { billingData: { gender: true } },
            order: { isDefault: 'DESC' },
        });

        const billing = link?.billingData;
        if (!billing) continue;

        let changed = false;

        if (!customer.gender && billing.gender) {
            customer.gender = billing.gender;
            changed = true;
        }

        if (!customer.birthDate && billing.birthdate) {
            const parsed = new Date(billing.birthdate);
            if (!isNaN(parsed.getTime())) {
                customer.birthDate = parsed;
                changed = true;
            }
        }

        if (changed) {
            await customerRepo.save(customer);
            updated++;
        }
    }

    logger.log(`Backfill completado. Customers actualizados: ${updated}`);
}