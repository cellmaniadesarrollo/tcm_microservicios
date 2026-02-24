import { BadRequestException, ForbiddenException, Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Customer } from './entities/customer.entity';
import { Contact } from './entities/contact.entity';
import { Address } from './entities/address.entity';
import { MoreThan, QueryFailedError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { BroadcastService } from '../broadcast/broadcast.service';
@Injectable()
export class CustomersService {
    private readonly logger = new Logger(CustomersService.name);
    constructor(
        @InjectRepository(Customer)
        private readonly customerRepo: Repository<Customer>,

        @InjectRepository(Contact)
        private readonly contactRepo: Repository<Contact>,

        @InjectRepository(Address)
        private readonly addressRepo: Repository<Address>,
        private readonly broadcast: BroadcastService,
    ) { }

    async create(data: any) {
        try {
            // 1️⃣ Validaciones mínimas de entrada
            if (!data?.user?.companyId) {
                throw new RpcException(
                    new BadRequestException('companyId es requerido'),
                );
            }

            if (!data?.customer?.idNumber) {
                throw new RpcException(
                    new BadRequestException('idNumber es requerido'),
                );
            }

            // 2️⃣ Crear instancia
            const customer = this.customerRepo.create({
                idType: { id: data.customer.idTypeId },
                idNumber: data.customer.idNumber,
                firstName: data.customer.firstName,
                lastName: data.customer.lastName,
                birthDate: data.customer.birthDate,
                gender: { id: data.customer.genderId },
                company: { id: data.user.companyId },

                contacts: data.customer.contacts?.map(c => ({
                    contactType: { id: c.contactTypeId },
                    value: c.value,
                    isPrimary: c.isPrimary ?? false,
                })),

                addresses: data.customer.addresses?.map(a => ({
                    city: { id: a.cityId },
                    zone: a.zone,
                    sector: a.sector,
                    locality: a.locality,
                    mainStreet: a.mainStreet,
                    secondaryStreet: a.secondaryStreet,
                    reference: a.reference,
                    postalCode: a.postalCode,
                })),
            });

            // 3️⃣ Guardar
            const customerSaved = await this.customerRepo.save(customer);

            // 4️⃣ Cargar relaciones
            const customerWithRelations = await this.customerRepo.findOne({
                where: { id: customerSaved.id },
                relations: {
                    idType: true,
                    gender: true,
                    contacts: { contactType: true },
                    addresses: { city: true },
                },
            });

            // 5️⃣ Evento (NO bloquea creación)
            try {
                await this.broadcast.publish('customer.updated', {
                    internalToken: process.env.INTERNAL_SECRET,
                    customer: customerWithRelations,
                });
            } catch (eventError) {
                // Log interno, pero no rompemos la operación
                console.error('Error publicando evento customer.updated', eventError);
            }

            return customerWithRelations;

        } catch (error) {

            // 🔴 Constraint UNIQUE (cliente duplicado)
            if (error instanceof QueryFailedError) {
                const driverError: any = error.driverError;

                if (driverError?.code === '23505') {
                    throw new RpcException(
                        new ForbiddenException(
                            'Ya existe un cliente con este documento en la empresa',
                        ),
                    );
                }
            }

            // 🔴 Errores de negocio ya controlados
            if (error instanceof RpcException) {
                throw error;
            }

            // 🔴 Error inesperado
            throw new RpcException(
                new InternalServerErrorException(
                    'Error al crear el cliente',
                ),
            );
        }
    }

    async update(id: number, updates: any, user: any) {

        const customer = await this.customerRepo.findOne({
            where: {
                id,
                company: {
                    id: user.companyId,
                },
            },
            relations: ['contacts', 'addresses'],
        });
        if (!customer) {
            throw new Error('Customer not found');
        }

        // NO permitir modificar DNI ni tipo de identificación
        delete updates.idNumber;
        delete updates.idTypeId;

        // Actualizar datos simples
        if (updates.firstName !== undefined)
            customer.firstName = updates.firstName;

        if (updates.lastName !== undefined)
            customer.lastName = updates.lastName;

        if (updates.birthDate !== undefined)
            customer.birthDate = updates.birthDate;

        if (updates.genderId !== undefined)
            customer.gender = { id: updates.genderId } as any;

        if (updates.company !== undefined)
            customer.company = updates.company;

        // CONTACTOS (si vienen)
        if (updates.contacts) {
            customer.contacts = updates.contacts.map(c => ({
                id: c.id ?? undefined,
                contactType: c.contactTypeId ? { id: c.contactTypeId } : undefined,
                value: c.value,
                isPrimary: c.isPrimary ?? false,
                customer: { id } as any
            }));
        }

        // DIRECCIONES (si vienen)
        if (updates.addresses) {
            customer.addresses = updates.addresses.map(a => ({
                id: a.id ?? undefined,
                city: a.cityId ? { id: a.cityId } : null,
                zone: a.zone,
                sector: a.sector,
                locality: a.locality,
                mainStreet: a.mainStreet,
                secondaryStreet: a.secondaryStreet,
                reference: a.reference,
                postalCode: a.postalCode,
                customer: { id } as any
            }));
        }

        const customersave = await this.customerRepo.save(customer);
        const customersavedata = await this.customerRepo.findOne({
            where: { id: customersave.id },
            relations: {
                idType: true,
                gender: true,
                contacts: {
                    contactType: true,
                },
                addresses: {
                    city: true,
                }
            }
        });

        await this.broadcast.publish('customer.updated', { internalToken: process.env.INTERNAL_SECRET, customer: customersavedata });
        return customersave;
    }
    async findPaginated(
        dto: { page: number; limit: number; search?: string },
        user: any
    ) {
        const { page, limit, search } = dto;
        const skip = (page - 1) * limit;

        const query = this.customerRepo
            .createQueryBuilder("c")

            // 🔒 MULTI-TENANT: solo clientes de la empresa
            .where("c.companyId = :companyId", {
                companyId: user.companyId,
            })

            // 🔹 Relaciones
            .leftJoinAndSelect("c.idType", "idType")
            .leftJoinAndSelect("c.gender", "gender")

            .leftJoinAndSelect("c.contacts", "contacts")
            .leftJoinAndSelect("contacts.contactType", "contactType")

            .leftJoinAndSelect("c.addresses", "addresses")
            .leftJoinAndSelect("addresses.city", "city")

            .skip(skip)
            .take(limit);

        // 🔍 BÚSQUEDA MULTI PALABRA
        if (search && search.trim() !== "") {
            const terms = search.split(" ").filter(Boolean);

            terms.forEach((term, index) => {
                const param = `term${index}`;
                query.andWhere(
                    `(c.idNumber ILIKE :${param}
          OR c.firstName ILIKE :${param}
          OR c.lastName ILIKE :${param})`,
                    { [param]: `%${term}%` }
                );
            });
        }

        const [items, total] = await query.getManyAndCount();

        return {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            items,
        };
    }



    async getCustomersUpdatedAfter(lastUpdatedAt: Date | null) {
        // 👉 Si es null, devolver TODOS
        if (!lastUpdatedAt) {
            return await this.customerRepo.find({
                relations: {
                    idType: true,
                    gender: true,
                    contacts: {
                        contactType: true,
                    },
                    addresses: {
                        city: true,
                    },
                },
                order: { updatedAt: 'ASC' },
            });
        }

        // 👉 Si viene fecha, solo posteriores
        return await this.customerRepo.find({
            where: {
                updatedAt: MoreThan(lastUpdatedAt),
            },
            relations: {
                idType: true,
                gender: true,
                contacts: {
                    contactType: true,
                },
                addresses: {
                    city: true,
                },
            },
            order: { updatedAt: 'ASC' },
        });
    }

}
