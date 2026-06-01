import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not, IsNull } from 'typeorm';
import { CustomerCache } from './entities/customer-cache.entity';

@Injectable()
export class CustomersEventsService {
    constructor(
        @InjectRepository(CustomerCache)
        private readonly customerCacheRepo: Repository<CustomerCache>,

        private readonly dataSource: DataSource,
    ) { }

    /**
     * Sincroniza el cliente recibido desde el microservicio Customers
     * Se usa tanto para customer.created como customer.updated
     */
    async syncCustomer(customer: any) {
        const mapped = {
            id: customer.id,
            idNumber: customer.idNumber,
            idTypeName: customer.idType?.name ?? null,
            firstName: customer.firstName,
            lastName: customer.lastName,
            company: customer.company,
            createdAt: customer.createdAt,
            updatedAt: customer.updatedAt,
        };

        const existing = await this.customerCacheRepo.findOne({
            where: { id: mapped.id },
        });

        if (existing) {
            await this.customerCacheRepo.save({
                ...existing,
                ...mapped,
            });
        } else {
            // 💡 Agregado await que faltaba para asegurar la persistencia
            await this.customerCacheRepo.save(mapped);
        }
    }

    /**
     * Obtener cliente replicado (para órdenes)
     */
    async findCustomer(id: number) {
        return this.customerCacheRepo.findOne({
            where: { id },
        });
    }

    /**
     * 📌 Devuelve los timestamps más recientes guardados en el cache local.
     * Si no existe nada, devuelve null para indicar sincronización completa.
     */
    async getLastTimestamps() {
        const [lastCustomer] = await this.customerCacheRepo.find({
            select: {
                id: true,
                updatedAt: true,
            },
            where: {
                updatedAt: Not(IsNull()),
            },
            order: { updatedAt: 'DESC' },
            take: 1,
        });

        return lastCustomer?.updatedAt ?? null;
    }

    /**
     * 🔥 Sincronización masiva (que me perdí + sincronización inicial)
     */
    async syncCustomersBulk(customers: any[]) {
        if (!customers || customers.length === 0) return;

        await this.dataSource.transaction(async (manager) => {
            const customerRepo = manager.getRepository(CustomerCache);

            for (const customer of customers) {
                const mapped = {
                    id: customer.id,
                    idNumber: customer.idNumber,
                    idTypeName: customer.idType?.name ?? null,
                    firstName: customer.firstName,
                    lastName: customer.lastName,
                    company: customer.company,
                    createdAt: customer.createdAt,
                    updatedAt: customer.updatedAt,
                };

                const existing = await customerRepo.findOne({
                    where: { id: mapped.id },
                });

                if (existing) {
                    await customerRepo.save({
                        ...existing,
                        ...mapped,
                    });
                } else {
                    await customerRepo.save(mapped);
                }
            }
        });

        console.log(`✔ Sincronización masiva completada (${customers.length} clientes)`);
    }
}