import {
    BadRequestException, ForbiddenException,
    Injectable, InternalServerErrorException, Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Like, QueryFailedError, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { BillingData } from './entities/billing-data.entity';
import { CustomerBillingData } from './entities/customer-billing-data.entity';
import { Customer } from '../customers/entities/customer.entity';
import { ContactType } from '../catalogs/entities/contact-type.entity';
import { IdType } from '../catalogs/entities/id-type.entity';
import { BroadcastService } from '../broadcast/broadcast.service';
import { PersonType } from '../catalogs/entities/person-type.entity';
import { Gender } from '../catalogs/entities/gender.entity';
import { backfillMissingCustomerPersonalData } from './helpers/customer-personal-data.helper';
import { Contact } from '../customers/entities/contact.entity';

interface BillingUpsertInput {
    companyId: string;
    idNumber: string;
    idTypeId: number;
    personTypeId: number;
    genderId?: number;
    firstName?: string;
    lastName?: string;
    businessName?: string;
    tradeName?: string;
    mainEmail: string;
    cellphone?: string;
    phone?: string;
    birthdate?: string; // 'YYYY-MM-DD'
    address: string;
    city?: string;
    isCompanyClient?: boolean;
}
@Injectable()
export class BillingService {
    private readonly logger = new Logger(BillingService.name);

    constructor(
        @InjectRepository(BillingData)
        private readonly billingRepo: Repository<BillingData>,

        @InjectRepository(CustomerBillingData)
        private readonly pivotRepo: Repository<CustomerBillingData>,

        @InjectRepository(Customer)
        private readonly customerRepo: Repository<Customer>,
        @InjectRepository(ContactType)
        private readonly contactTypeRepo: Repository<ContactType>,


        @InjectRepository(PersonType)
        private readonly personTypeRepo: Repository<PersonType>,

        @InjectRepository(Gender)
        private readonly genderRepo: Repository<Gender>,

        @InjectRepository(IdType)
        private readonly idTypeRepo: Repository<IdType>,
        private readonly broadcast: BroadcastService,

        @InjectRepository(Contact)
        private readonly contactRepo: Repository<Contact>,
        private readonly dataSource: DataSource
    ) { }
    async onModuleInit() {
        try {
            await backfillMissingCustomerPersonalData(this.customerRepo, this.pivotRepo);
        } catch (err) {
            this.logger.error('Error en backfill de customers (gender/birthDate):', err);
        }
    }
    // ─── Crear BillingData y vincularlo al cliente ───────────────────────────
    async create(data: any) {
        console.log(data)
        const logger = new Logger('RetailBilling');
        try {
            if (!data?.user?.companyId)
                throw new RpcException(new BadRequestException('companyId es requerido'));
            if (!data?.idNumber)
                throw new RpcException(new BadRequestException('idNumber es requerido'));
            if (!data?.idTypeId)
                throw new RpcException(new BadRequestException('idTypeId es requerido'));
            if (!data?.personTypeId)
                throw new RpcException(new BadRequestException('personTypeId es requerido'));
            if (!data?.mainEmail)
                throw new RpcException(new BadRequestException('mainEmail es requerido'));
            if (!data?.address)
                throw new RpcException(new BadRequestException('address es requerido'));

            return await this.upsertCustomerAndBillingData(
                {
                    companyId: data.user.companyId,
                    idNumber: data.idNumber,
                    idTypeId: data.idTypeId,
                    personTypeId: data.personTypeId,
                    genderId: data.genderId,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    businessName: data.businessName,
                    tradeName: data.tradeName,
                    mainEmail: data.mainEmail,
                    cellphone: data.cellphone,
                    phone: data.phone,
                    birthdate: data.birthdate,
                    address: data.address,
                    city: data.city,
                    isCompanyClient: data.isCompanyClient ?? false,
                },
                logger,
            );
        } catch (error) {
            logger.error(error);
            if (error instanceof QueryFailedError && (error.driverError as any)?.code === '23505')
                throw new RpcException(
                    new ForbiddenException('Ya existe un dato de facturación con este documento en la empresa'),
                );
            if (error instanceof RpcException) throw error;
            throw new RpcException(new InternalServerErrorException('Error al crear dato de facturación'));
        }
    }

    // ─── Editar BillingData ──────────────────────────────────────────────────
    // ─── Editar BillingData ──────────────────────────────────────────────────
    async update(data: any) {
        const logger = new Logger('BillingUpdate');
        try {

            if (!data?.id)
                throw new RpcException(new BadRequestException('id es requerido'));

            if (!data?.user?.companyId)
                throw new RpcException(new BadRequestException('companyId es requerido'));

            const billing = await this.billingRepo.findOne({
                where: { id: data.id, company: { id: data.user.companyId } },
            });

            if (!billing)
                throw new RpcException(new BadRequestException('Dato de facturación no encontrado'));

            // 👇 Debe reflejar los campos del UpdateBillingDto.
            // Si en el futuro el DTO agrega más campos (ej: genderId, birthdate),
            // basta con sumarlos acá — no afecta a los customers vinculados (replicas),
            // billing es la única entidad que se toca en este método.
            const allowed = [
                'idTypeId',
                'idNumber',
                'businessName',
                'tradeName',
                'mainEmail',
                'phone',
                'address',
                'city',
                'isActive',
            ];

            for (const key of allowed) {
                if (data.updates?.[key] !== undefined) {
                    if (key === 'idTypeId') {
                        billing.idType = { id: data.updates.idTypeId } as any;
                    } else {
                        (billing as any)[key] = data.updates[key];
                    }
                }
            }

            await this.billingRepo.save(billing);

            // ── Retornar resultado actualizado con relations (igual que legacy) ──
            const result = await this.billingRepo.findOne({
                where: { id: billing.id },
                relations: { idType: true, personType: true, customerLinks: { customer: true } },
            });

            // ── Emitir evento Kafka ───────────────────────────────────────
            try {
                await this.broadcast.publishClientBillingUpdated(result);
            } catch (eventError) {
                logger.error('Error publicando evento publishClientBillingUpdated:', eventError);
            }

            return result;

        } catch (error) {
            logger.error(error);
            if (error instanceof RpcException) throw error;
            throw new RpcException(new InternalServerErrorException('Error al actualizar dato de facturación'));
        }
    }

    // ─── Vincular BillingData existente a un cliente ─────────────────────────
    async linkToCustomer(data: any) {
        try {
            if (!data?.billingDataId || !data?.customerId)
                throw new RpcException(new BadRequestException('billingDataId y customerId son requeridos'));

            const exists = await this.pivotRepo.findOne({
                where: { customer: { id: data.customerId }, billingData: { id: data.billingDataId } },
            });

            if (exists)
                throw new RpcException(new BadRequestException('Este dato ya está vinculado al cliente'));

            const pivot = this.pivotRepo.create({
                customer: { id: data.customerId },
                billingData: { id: data.billingDataId },
                isDefault: data.isDefault ?? false,
            });

            return await this.pivotRepo.save(pivot);

        } catch (error) {
            if (error instanceof RpcException) throw error;
            throw new RpcException(new InternalServerErrorException('Error al vincular dato de facturación'));
        }
    }

    // ─── Desvincular BillingData de un cliente ───────────────────────────────
    async unlinkFromCustomer(data: any) {
        try {
            if (!data?.billingDataId || !data?.customerId)
                throw new RpcException(new BadRequestException('billingDataId y customerId son requeridos'));

            const pivot = await this.pivotRepo.findOne({
                where: { customer: { id: data.customerId }, billingData: { id: data.billingDataId } },
            });

            if (!pivot)
                throw new RpcException(new BadRequestException('Vínculo no encontrado'));

            await this.pivotRepo.remove(pivot);

            return { message: 'Dato de facturación desvinculado correctamente' };

        } catch (error) {
            if (error instanceof RpcException) throw error;
            throw new RpcException(new InternalServerErrorException('Error al desvincular dato de facturación'));
        }
    }

    // ─── Obtener BillingData de un cliente ───────────────────────────────────
    async getByCustomer(data: any) {
        try {
            if (!data?.customerId)
                throw new RpcException(new BadRequestException('customerId es requerido'));

            return await this.pivotRepo.find({
                where: { customer: { id: data.customerId } },
                relations: { billingData: { idType: true } },
                order: { isDefault: 'DESC' },
            });

        } catch (error) {
            if (error instanceof RpcException) throw error;
            throw new RpcException(new InternalServerErrorException('Error al obtener datos de facturación'));
        }
    }

    // ─── Buscar BillingData por idNumber dentro de la empresa ─────────────────
    async search(data: any) {
        try {
            if (!data?.user?.companyId)
                throw new RpcException(new BadRequestException('companyId es requerido'));

            if (!data?.idNumber || data.idNumber.trim().length < 3)
                throw new RpcException(new BadRequestException('Ingrese al menos 3 caracteres'));

            const dtos = await this.billingRepo.find({
                where: {
                    company: { id: data.user.companyId },
                    idNumber: Like(`%${data.idNumber.trim()}%`),
                    isActive: true,
                },
                relations: {
                    idType: true,
                    personType: true,
                    gender: true,
                    customerLinks: { customer: true },   // 👈 nuevo
                },
                order: { firstName: 'ASC' },
                take: 10,
            });

            return dtos
        } catch (error) {
            if (error instanceof RpcException) throw error;
            throw new RpcException(new InternalServerErrorException('Error al buscar datos de facturación'));
        }
    }


    async createFromLegacyRaw(raw: any) {
        // companyId ya viene dentro del payload legacy
        if (!raw?.company_id && !raw?.user?.companyId)
            throw new RpcException(new BadRequestException('companyId ausente en payload legacy'));

        const companyId = raw.company_id ?? raw.user?.companyId;

        const normalized = await this.normalizeLegacyPayload(raw, { companyId });

        return this.createFromLegacy(normalized);
    }

    async createFromLegacy(data: any) {
        const logger = new Logger('LegacyBilling');
        try {
            if (!data?.user?.companyId)
                throw new RpcException(new BadRequestException('companyId ausente en token legacy'));
            if (!data?.idNumber)
                throw new RpcException(new BadRequestException('idNumber es requerido'));
            if (!data?.idTypeId)
                throw new RpcException(new BadRequestException('idTypeId es requerido'));
            if (!data?.personTypeId)
                throw new RpcException(new BadRequestException('personTypeId es requerido'));

            return await this.upsertCustomerAndBillingData(
                {
                    companyId: data.user.companyId,
                    idNumber: data.idNumber,
                    idTypeId: data.idTypeId,
                    personTypeId: data.personTypeId,
                    genderId: data.genderId,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    businessName: data.businessName,
                    tradeName: data.tradeName,
                    mainEmail: data.mainEmail,
                    cellphone: data.cellphone,
                    phone: data.phone,
                    birthdate: data.birthdate,
                    address: data.address,
                    city: data.city,
                    isCompanyClient: data.isCompanyClient ?? false,
                },
                logger,
            );
        } catch (error) {
            logger.error(error);
            if (error instanceof RpcException) throw error;
            throw new RpcException(new InternalServerErrorException('Error procesando billing desde legacy'));
        }
    }
    async updateFromLegacyRaw(raw: any) {
        if (!raw?.company_id && !raw?.user?.companyId)
            throw new RpcException(new BadRequestException('companyId ausente en payload legacy'));

        if (!raw?.billingId)
            throw new RpcException(new BadRequestException('billingId ausente en payload'));

        const companyId = raw.company_id ?? raw.user?.companyId;
        const normalized = await this.normalizeLegacyPayload(raw, { companyId });

        return this.updateFromLegacy({ ...normalized, billingId: raw.billingId }); // 👈 pasa el id
    }

    async updateFromLegacy(data: any) {
        const logger = new Logger('LegacyBillingUpdate');

        try {
            // ── Validaciones ──────────────────────────────────────────────
            if (!data?.user?.companyId)
                throw new RpcException(new BadRequestException('companyId ausente'));
            if (!data?.billingId)
                throw new RpcException(new BadRequestException('billingId es requerido'));
            if (!data?.idNumber)
                throw new RpcException(new BadRequestException('idNumber es requerido'));
            if (!data?.idTypeId)
                throw new RpcException(new BadRequestException('idTypeId es requerido'));
            if (!data?.personTypeId)
                throw new RpcException(new BadRequestException('personTypeId es requerido'));

            // ── Buscar billing por id — 404 si no existe ──────────────────
            const existingBilling = await this.billingRepo.findOne({
                where: {
                    id: data.billingId,
                    company: { id: data.user.companyId },
                },
            });

            if (!existingBilling)
                throw new RpcException(
                    new NotFoundException(`BillingData no encontrado id: ${data.billingId}`),
                );

            logger.log(`Actualizando BillingData id: ${existingBilling.id}`);

            // ── Actualizar todos los campos editables ─────────────────────
            await this.billingRepo.update(existingBilling.id, {
                idType: { id: data.idTypeId },
                personType: { id: data.personTypeId },
                gender: data.genderId ? { id: data.genderId } : undefined,
                idNumber: data.idNumber,
                tradeName: data.tradeName,
                firstName: data.firstName,
                lastName: data.lastName,
                mainEmail: data.mainEmail,
                cellphone: data.cellphone,
                phone: data.phone,
                birthdate: data.birthdate,
                address: data.address,
                city: data.city,
                isCompanyClient: data.isCompanyClient ?? false,
            });

            // ── Retornar resultado actualizado ────────────────────────────
            const result = await this.billingRepo.findOne({
                where: { id: existingBilling.id },
                relations: { idType: true, personType: true, customerLinks: { customer: { gender: true } } },
            });

            // 👇 Completa inline gender/birthDate en los customers vinculados (sin helper)
            if (result?.customerLinks?.length) {
                for (const link of result.customerLinks) {
                    const c = link.customer;
                    let changed = false;

                    if (!c.gender && data.genderId) {
                        c.gender = { id: data.genderId } as any;
                        changed = true;
                    }
                    if (!c.birthDate && data.birthdate) {
                        const parsed = new Date(data.birthdate);
                        if (!isNaN(parsed.getTime())) {
                            c.birthDate = parsed;
                            changed = true;
                        }
                    }
                    if (changed) {
                        await this.customerRepo.save(c);
                    }
                }
            }

            // ── Emitir evento Kafka ───────────────────────────────────────
            try {
                await this.broadcast.publishClientBillingUpdated(result);
            } catch (eventError) {
                logger.error('Error publicando evento publishClientBillingUpdated:', eventError);
            }

            return result;

        } catch (error) {
            logger.error(error);
            if (error instanceof RpcException) throw error;
            throw new RpcException(
                new InternalServerErrorException('Error actualizando billing desde legacy'),
            );
        }
    }

    // ── Mapa estático de nombres legacy → nombre normalizado en BD ────────────────
    private readonly LEGACY_ID_TYPE_MAP: Record<string, string> = {
        'Cédula': 'CÉDULA',
        'RUC': 'RUC',
        'Pasaporte': 'PASAPORTE',
        'Venta a Consumidor Final': 'CONSUMIDOR FINAL',
        'Identificación del Exterior': 'IDENTIFICACIÓN DEL EXTERIOR',
    };

    private readonly LEGACY_PERSON_TYPE_MAP: Record<string, string> = {
        'natural': 'NATURAL',
        'juridica': 'JURIDICA',
    };

    private readonly LEGACY_GENDER_MAP: Record<string, string> = {
        'male': 'MASCULINO',
        'female': 'FEMENINO',
        'other': 'OTRO',
    };

    // ── Adaptador: convierte el payload legacy al contrato de createFromLegacy ────
    async normalizeLegacyPayload(raw: any, user: { companyId: string }) {
        const logger = new Logger('LegacyAdapter');

        // 1. Resolver IdType
        const idTypeName = this.LEGACY_ID_TYPE_MAP[raw.identification_type];
        if (!idTypeName)
            throw new RpcException(
                new BadRequestException(`identification_type desconocido: ${raw.identification_type}`),
            );

        const idType = await this.idTypeRepo.findOne({ where: { name: idTypeName } });
        if (!idType)
            throw new RpcException(
                new BadRequestException(`IdType no encontrado en BD: ${idTypeName}`),
            );

        // 2. Resolver PersonType
        const personTypeName = this.LEGACY_PERSON_TYPE_MAP[raw.person_type];
        if (!personTypeName)
            throw new RpcException(
                new BadRequestException(`person_type desconocido: ${raw.person_type}`),
            );

        const personType = await this.personTypeRepo.findOne({ where: { name: personTypeName } });
        if (!personType)
            throw new RpcException(
                new BadRequestException(`PersonType no encontrado en BD: ${personTypeName}`),
            );

        // 3. Resolver Gender (opcional)
        let genderId: number | undefined;
        if (raw.sex && raw.sex !== 'N/A') {
            const genderName = this.LEGACY_GENDER_MAP[raw.sex];
            if (genderName) {
                console.log(genderName)
                const gender = await this.genderRepo.findOne({ where: { name: genderName } });

                genderId = gender?.id;
                if (!gender)
                    logger.warn(`Gender '${raw.sex}' → '${genderName}' no encontrado en BD, se omitirá`);
            }
        }

        // 4. Normalizar birthdate → string 'YYYY-MM-DD' si viene como Date
        let birthdate: string | undefined;
        if (raw.birthdate) {
            const d = new Date(raw.birthdate);
            if (!isNaN(d.getTime()))
                birthdate = d.toISOString().split('T')[0]; // '2026-04-06'
        }

        // 5. Construir el payload que espera createFromLegacy
        return {
            user,                               // { companyId }
            idNumber: raw.identification,
            idTypeId: idType.id,
            personTypeId: personType.id,
            genderId,
            firstName: raw.first_name,
            lastName: raw.last_name,
            businessName: raw.business_name,   // undefined en persona natural → ok
            tradeName: undefined,
            mainEmail: raw.email,
            cellphone: raw.cellphone,
            phone: raw.phone,
            birthdate,
            address: raw.address,
            city: raw.city,
            isCompanyClient: raw.person_type === 'juridica',
        };
    }



    private async publishMinimalCustomerCreated(customerId: number): Promise<void> {
        const logger = new Logger('LegacyBilling');

        const customerWithRelations = await this.customerRepo.findOne({
            where: { id: customerId },
            relations: {
                idType: true,
                gender: true,
                contacts: { contactType: true },
                addresses: { city: true },
            },
        });

        if (!customerWithRelations) {
            logger.warn(`No se encontró el cliente ${customerId} para publicar evento`);
            return;
        }

        try {
            await this.broadcast.publishClientCreated(customerWithRelations);
            logger.log(`📤 Evento CLIENT_CREATED emitido para cliente mínimo id: ${customerId}`);
        } catch (eventError) {
            console.error('Error publicando evento CLIENT_CREATED (legacy):', eventError);
        }
    }

    async createCustomerWithBilling(data: any) {
        const logger = new Logger('CreateCustomerWithBilling');

        // Guardamos qué eventos hay que emitir DESPUÉS del commit,
        // para no notificar cambios que luego se revierten por un fallo posterior.
        let shouldPublishClientCreated = false;
        let shouldPublishBillingCreated = false;

        try {
            if (!data?.user?.companyId)
                throw new RpcException(new BadRequestException('companyId es requerido'));

            const c = data.customer;
            if (!c?.idNumber)
                throw new RpcException(new BadRequestException('idNumber del cliente es requerido'));

            const result = await this.dataSource.transaction(async (manager) => {
                const customerRepo = manager.getRepository(Customer);
                const billingRepo = manager.getRepository(BillingData);
                const customerBillingRepo = manager.getRepository(CustomerBillingData);

                // ── 1. Buscar o crear Customer ──────────────────────────────
                let customer = await customerRepo.findOne({
                    where: { idNumber: c.idNumber, company: { id: data.user.companyId } },
                    relations: { idType: true, gender: true, contacts: { contactType: true }, addresses: { city: true } },
                });

                let customerCreated = false;

                if (!customer) {
                    const newCustomer = customerRepo.create({
                        company: { id: data.user.companyId },
                        idType: { id: c.idTypeId },
                        idNumber: c.idNumber,
                        firstName: c.firstName,
                        lastName: c.lastName,
                        birthDate: c.birthDate ? new Date(c.birthDate) : undefined,
                        gender: c.genderId ? { id: c.genderId } : undefined,
                        contacts: c.contacts?.map((ct: any) => ({
                            contactType: { id: ct.contactTypeId },
                            value: ct.value,
                            isPrimary: ct.isPrimary ?? false,
                        })),
                        addresses: c.addresses?.map((a: any) => ({
                            city: a.cityId ? { id: a.cityId } : undefined,
                            zone: a.zone,
                            sector: a.sector,
                            locality: a.locality,
                            mainStreet: a.mainStreet,
                            secondaryStreet: a.secondaryStreet,
                            reference: a.reference,
                            postalCode: a.postalCode,
                        })),
                    });

                    const saved = await customerRepo.save(newCustomer);
                    const refetched = await customerRepo.findOne({
                        where: { id: saved.id },
                        relations: { idType: true, gender: true, contacts: { contactType: true }, addresses: { city: true } },
                    });

                    if (!refetched)
                        throw new RpcException(new InternalServerErrorException('Error recuperando el customer recién creado'));

                    customer = refetched;
                    customerCreated = true;
                    shouldPublishClientCreated = true;
                    logger.log(`Customer creado id: ${customer.id}`);
                } else {
                    logger.log(`Customer ya existía id: ${customer.id}, se reutiliza (no se sobreescriben datos)`);
                }

                // ── 2. Billing (opcional) ───────────────────────────────────
                let billingSaved: BillingData | null = null;
                let billingCreated = false;

                if (data.billing) {
                    const b = data.billing;

                    const existingBilling = await billingRepo.findOne({
                        where: { idNumber: c.idNumber, company: { id: data.user.companyId } },
                    });

                    if (existingBilling) {
                        billingSaved = existingBilling;
                        logger.log(`BillingData ya existía id: ${existingBilling.id}, se reutiliza`);
                    } else {
                        const emailContact = customer.contacts?.find((ct) => ct.contactType?.name === 'EMAIL');
                        const mobileContact = customer.contacts?.find((ct) => ct.contactType?.name === 'MÓVIL');
                        const phoneContact = customer.contacts?.find((ct) => ct.contactType?.name === 'TELÉFONO');

                        const primaryAddress = customer.addresses?.[0];
                        const flattenedAddress = primaryAddress
                            ? [primaryAddress.mainStreet, primaryAddress.secondaryStreet, primaryAddress.reference]
                                .filter(Boolean)
                                .join(', ')
                            : '';

                        let billingFirstName = customer.firstName;
                        let billingLastName = customer.lastName;
                        if (b.businessName?.trim()) {
                            const parts = b.businessName.trim().split(' ');
                            billingFirstName = parts[0];
                            billingLastName = parts.slice(1).join(' ') || parts[0];
                        }

                        const mainEmail = b.mainEmailOverride ?? emailContact?.value;
                        if (!mainEmail)
                            throw new RpcException(
                                new BadRequestException('mainEmail es requerido para crear la facturación (no hay contacto EMAIL ni override)'),
                            );

                        const billing = billingRepo.create({
                            company: { id: data.user.companyId },
                            idType: { id: c.idTypeId },
                            idNumber: c.idNumber,
                            personType: { id: b.personTypeId },
                            gender: c.genderId ? { id: c.genderId } : undefined,
                            firstName: billingFirstName,
                            lastName: billingLastName,
                            tradeName: b.tradeName,
                            mainEmail,
                            cellphone: mobileContact?.value,
                            phone: phoneContact?.value,
                            birthdate: c.birthDate ? new Date(c.birthDate).toISOString().split('T')[0] : undefined,
                            address: b.addressOverride ?? flattenedAddress,
                            city: b.cityOverride ?? primaryAddress?.city?.name,
                            isCompanyClient: b.isCompanyClient ?? false,
                            customer: { id: customer.id },
                        });

                        billingSaved = await billingRepo.save(billing);
                        billingCreated = true;
                        shouldPublishBillingCreated = true;
                        logger.log(`BillingData creado id: ${billingSaved.id}`);
                    }

                    // ── 3. Vincular pivot (CustomerBillingData) ──────────────
                    const alreadyLinked = await customerBillingRepo.findOne({
                        where: { customer: { id: customer.id }, billingData: { id: billingSaved.id } },
                    });

                    if (!alreadyLinked) {
                        await customerBillingRepo.save(
                            customerBillingRepo.create({
                                customer: { id: customer.id },
                                billingData: { id: billingSaved.id },
                                isDefault: true,
                            }),
                        );
                    }
                }

                return { customer, billing: billingSaved };
            });

            // ── Eventos: solo DESPUÉS de que la transacción hizo commit ────
            if (shouldPublishClientCreated) {
                try {
                    await this.broadcast.publishClientCreated(result.customer);
                } catch (eventError) {
                    console.error('Error publicando CLIENT_CREATED:', eventError);
                }
            }

            if (shouldPublishBillingCreated && result.billing) {
                try {
                    const billingWithRelations = await this.billingRepo.findOne({
                        where: { id: result.billing.id },
                        relations: { idType: true, personType: true, gender: true, customerLinks: { customer: true } },
                    });
                    await this.broadcast.publishClientBillingCreated(billingWithRelations);
                } catch (eventError) {
                    console.error('Error publicando CLIENT_BILLING_CREATED:', eventError);
                }
            }

            return result;

        } catch (error) {
            logger.error(error);
            if (error instanceof QueryFailedError && (error.driverError as any)?.code === '23505')
                throw new RpcException(new ForbiddenException('Ya existe un cliente o dato de facturación con este documento'));
            if (error instanceof RpcException) throw error;
            throw new RpcException(new InternalServerErrorException('Error creando cliente con facturación'));
        }
    }



    private async upsertCustomerAndBillingData(input: BillingUpsertInput, logger: Logger) {
        let somethingWasCreated = false;

        // ── Buscar o crear BillingData ──────────────────────────
        let billingSaved = await this.billingRepo
            .createQueryBuilder('b')
            .where('b.idNumber = :idNumber', { idNumber: input.idNumber })
            .andWhere('b.companyId = :companyId', { companyId: input.companyId })
            .getOne();

        if (billingSaved) {
            logger.log(`BillingData ya existe id: ${billingSaved.id}`);
        } else {
            const billing = this.billingRepo.create({
                company: { id: input.companyId },
                idType: { id: input.idTypeId },
                personType: { id: input.personTypeId },
                gender: input.genderId ? { id: input.genderId } : undefined,
                idNumber: input.idNumber,
                tradeName: input.tradeName,
                firstName: input.firstName,      // 👈 sin businessName aquí, igual que el legacy original
                lastName: input.lastName,
                mainEmail: input.mainEmail,
                cellphone: input.cellphone,
                phone: input.phone,
                birthdate: input.birthdate,
                address: input.address,
                city: input.city,
                isCompanyClient: input.isCompanyClient ?? false,
            });
            billingSaved = await this.billingRepo.save(billing);
            somethingWasCreated = true;
            logger.log(`BillingData creado id: ${billingSaved.id}`);
        }

        // ── Resolver ContactTypes una sola vez ───────────────────
        const emailContactType = await this.contactTypeRepo.findOne({ where: { name: 'EMAIL' } });
        const mobileContactType = await this.contactTypeRepo.findOne({ where: { name: 'MÓVIL' } });
        const phoneContactType = await this.contactTypeRepo.findOne({ where: { name: 'TELÉFONO' } });

        // ── Buscar o crear Customer ──────────────────────────────
        let customer = await this.customerRepo
            .createQueryBuilder('c')
            .leftJoinAndSelect('c.gender', 'gender')
            .leftJoinAndSelect('c.contacts', 'contacts')
            .leftJoinAndSelect('contacts.contactType', 'contactType')
            .where('c.idNumber = :idNumber', { idNumber: input.idNumber })
            .andWhere('c.companyId = :companyId', { companyId: input.companyId })
            .getOne();

        if (customer) {
            logger.log(`Customer ya existe id: ${customer.id}`);

            let customerChanged = false;
            if (!customer.gender && input.genderId) {
                customer.gender = { id: input.genderId } as any;
                customerChanged = true;
            }
            if (!customer.birthDate && input.birthdate) {
                const parsed = new Date(input.birthdate);
                if (!isNaN(parsed.getTime())) {
                    customer.birthDate = parsed;
                    customerChanged = true;
                }
            }
            if (customerChanged) {
                customer = await this.customerRepo.save(customer);
                logger.log(`Customer ${customer.id} actualizado con gender/birthDate faltantes`);
            }

            const missingContact = async (
                value: string | undefined,
                contactType: { id: number } | null,
                isPrimary: boolean,
                label: string,
            ) => {
                if (!value || !contactType) return;
                const has = customer!.contacts?.some((c) => c.contactType?.id === contactType.id);
                if (!has) {
                    const newContact = this.contactRepo.create({
                        contactType: { id: contactType.id },
                        value,
                        isPrimary: isPrimary && !customer!.contacts?.length,
                        customer: { id: customer!.id },
                    });
                    await this.contactRepo.save(newContact);
                    logger.log(`Contacto ${label} agregado al customer ${customer!.id}`);
                }
            };

            await missingContact(input.mainEmail, emailContactType, true, 'EMAIL');
            await missingContact(input.cellphone, mobileContactType, true, 'MÓVIL');
            await missingContact(input.phone, phoneContactType, false, 'TELÉFONO');
        } else {
            const contacts: any[] = [];

            if (input.mainEmail && emailContactType) {
                contacts.push({ contactType: { id: emailContactType.id }, value: input.mainEmail, isPrimary: true });
            }
            if (input.cellphone && mobileContactType) {
                contacts.push({
                    contactType: { id: mobileContactType.id },
                    value: input.cellphone,
                    isPrimary: !input.mainEmail,
                });
            }
            if (input.phone && phoneContactType) {
                contacts.push({ contactType: { id: phoneContactType.id }, value: input.phone, isPrimary: false });
            }

            const newCustomer = this.customerRepo.create({
                company: { id: input.companyId },
                idType: { id: input.idTypeId },
                idNumber: input.idNumber,
                firstName: input.firstName ?? input.businessName?.split(' ')[0] ?? 'S/N',
                lastName: input.lastName ?? input.businessName?.split(' ').slice(1).join(' ') ?? 'S/N',
                gender: input.genderId ? { id: input.genderId } : undefined,
                birthDate: input.birthdate ? new Date(input.birthdate) : undefined,
                isActive: true,
                contacts,
            });

            customer = await this.customerRepo.save(newCustomer);
            somethingWasCreated = true;
            await this.publishMinimalCustomerCreated(customer.id);
            logger.log(`Cliente mínimo creado id: ${customer.id}`);
        }

        // ── Vincular customer ↔ billingData ─────────────────────
        const alreadyLinked = await this.pivotRepo.findOne({
            where: { customer: { id: customer.id }, billingData: { id: billingSaved.id } },
        });

        if (alreadyLinked) {
            logger.log(`Vínculo ya existe customer ${customer.id} ↔ billing ${billingSaved.id}`);
        } else {
            await this.pivotRepo.save(
                this.pivotRepo.create({
                    customer: { id: customer.id },
                    billingData: { id: billingSaved.id },
                    isDefault: false,
                }),
            );
            somethingWasCreated = true;
            logger.log(`Vínculo creado customer ${customer.id} ↔ billing ${billingSaved.id}`);
        }

        const result = await this.billingRepo.findOne({
            where: { id: billingSaved.id },
            relations: { idType: true, personType: true, gender: true, customerLinks: { customer: true } },
        });

        if (somethingWasCreated) {
            try {
                await this.broadcast.publishClientBillingCreated(result);
            } catch (eventError) {
                console.error('Error publicando evento CLIENT_CREATED:', eventError);
            }
        } else {
            logger.log(`Todo ya existía, evento no publicado para idNumber: ${input.idNumber}`);
        }

        return result;
    }
}

