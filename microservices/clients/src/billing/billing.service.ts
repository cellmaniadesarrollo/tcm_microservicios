import {
    BadRequestException, ForbiddenException,
    Injectable, InternalServerErrorException, Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, QueryFailedError, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { BillingData } from './entities/billing-data.entity';
import { CustomerBillingData } from './entities/customer-billing-data.entity';
import { Customer } from '../customers/entities/customer.entity';
import { ContactType } from '../catalogs/entities/contact-type.entity';
import { IdType } from '../catalogs/entities/id-type.entity';
import { BroadcastService } from '../broadcast/broadcast.service';
import { PersonType } from '../catalogs/entities/person-type.entity';

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

        @InjectRepository(ContactType)
        private readonly genderRepo: Repository<ContactType>,

        @InjectRepository(IdType)
        private readonly idTypeRepo: Repository<IdType>,
        private readonly broadcast: BroadcastService,


    ) { }

    // ─── Crear BillingData y vincularlo al cliente ───────────────────────────
    async create(data: any) {
        try {
            if (!data?.user?.companyId)
                throw new RpcException(new BadRequestException('companyId es requerido'));

            if (!data?.customerId)
                throw new RpcException(new BadRequestException('customerId es requerido'));

            // Verificar que el cliente pertenece a la empresa
            const customer = await this.customerRepo.findOne({
                where: { id: data.customerId, company: { id: data.user.companyId } },
            });
            if (!customer)
                throw new RpcException(new BadRequestException('Cliente no encontrado en esta empresa'));

            // Crear BillingData con TODOS los campos nuevos
            const billing = this.billingRepo.create({
                company: { id: data.user.companyId },

                idType: { id: data.idTypeId },
                idNumber: data.idNumber,

                // ← NUEVOS CAMPOS OBLIGATORIOS
                personType: { id: data.personTypeId },
                mainEmail: data.mainEmail,
                address: data.address,

                // ← NUEVOS CAMPOS OPCIONALES
                tradeName: data.tradeName,
                firstName: data.firstName,
                lastName: data.lastName,
                gender: data.genderId ? { id: data.genderId } : undefined,
                birthdate: data.birthdate,
                cellphone: data.cellphone,
                phone: data.phone,
                city: data.city,
                isCompanyClient: data.isCompanyClient ?? false,
            });

            const billingSaved = await this.billingRepo.save(billing);

            // Vincular al cliente en la tabla pivote (se mantiene igual)
            const pivot = this.pivotRepo.create({
                customer: { id: data.customerId },
                billingData: { id: billingSaved.id },
                isDefault: data.isDefault ?? false,
            });

            await this.pivotRepo.save(pivot);

            // Retorno con todas las relaciones nuevas
            const customerBillingWithRelations = await this.billingRepo.findOne({
                where: { id: billingSaved.id },
                relations: {
                    idType: true,
                    gender: true,           // ← nuevo
                    personType: true,       // ← nuevo
                    customerLinks: {
                        customer: true,
                    },
                },
            });
            try {
                await this.broadcast.publishClientBillingCreated(customerBillingWithRelations);
            } catch (eventError) {
                console.error('Error publicando evento CLIENT_CREATED:', eventError);
            }
            return customerBillingWithRelations
        } catch (error) {
            console.log(error);

            if (error instanceof QueryFailedError && (error.driverError as any)?.code === '23505')
                throw new RpcException(
                    new ForbiddenException('Ya existe un dato de facturación con este documento en la empresa'),
                );

            if (error instanceof RpcException) throw error;

            throw new RpcException(new InternalServerErrorException('Error al crear dato de facturación'));
        }
    }

    // ─── Editar BillingData ──────────────────────────────────────────────────
    async update(data: any) {
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

            const allowed = ['idTypeId', 'idNumber', 'businessName', 'tradeName', 'mainEmail', 'phone', 'address', 'city', 'isActive'];

            for (const key of allowed) {
                if (data.updates?.[key] !== undefined) {
                    if (key === 'idTypeId') {
                        billing.idType = { id: data.updates.idTypeId } as any;
                    } else {
                        (billing as any)[key] = data.updates[key];
                    }
                }
            }

            return await this.billingRepo.save(billing);

        } catch (error) {
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

            return await this.billingRepo.find({
                where: {
                    company: { id: data.user.companyId },
                    idNumber: Like(`%${data.idNumber.trim()}%`),
                    isActive: true,
                },
                relations: { idType: true },
                order: { firstName: 'ASC' },
                take: 10,
            });

        } catch (error) {
            if (error instanceof RpcException) throw error;
            throw new RpcException(new InternalServerErrorException('Error al buscar datos de facturación'));
        }
    }


    async createFromLegacyRaw(raw: any) {
        console.log(`[RAW] antes de normalize: ${JSON.stringify(raw)}`);
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
            // ── Validaciones mínimas ──────────────────────────────────────
            if (!data?.user?.companyId)
                throw new RpcException(new BadRequestException('companyId ausente en token legacy'));

            if (!data?.idNumber)
                throw new RpcException(new BadRequestException('idNumber es requerido'));

            if (!data?.idTypeId)
                throw new RpcException(new BadRequestException('idTypeId es requerido'));

            if (!data?.personTypeId)
                throw new RpcException(new BadRequestException('personTypeId es requerido'));

            let somethingWasCreated = false;

            // ── Buscar o crear BillingData ────────────────────────────────
            let billingSaved: BillingData;

            const existingBilling = await this.billingRepo
                .createQueryBuilder('b')
                .where('b.idNumber = :idNumber', { idNumber: data.idNumber })
                .andWhere('b.companyId = :companyId', { companyId: data.user.companyId })
                .getOne();

            if (existingBilling) {
                logger.log(`BillingData ya existe id: ${existingBilling.id}`);
                billingSaved = existingBilling;
            } else {
                const billing = this.billingRepo.create({
                    company: { id: data.user.companyId },
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

                billingSaved = await this.billingRepo.save(billing);
                somethingWasCreated = true;
                logger.log(`BillingData creado id: ${billingSaved.id}`);
            }

            // ── Buscar o crear Customer mínimo ────────────────────────────
            let customer = await this.customerRepo
                .createQueryBuilder('c')
                .where('c.idNumber = :idNumber', { idNumber: data.idNumber })
                .andWhere('c.companyId = :companyId', { companyId: data.user.companyId })
                .getOne();

            if (customer) {
                logger.log(`Customer ya existe id: ${customer.id}`);
            } else {
                const emailContactType = await this.contactTypeRepo.findOne({
                    where: { name: 'EMAIL' },
                });

                const newCustomer = this.customerRepo.create({
                    company: { id: data.user.companyId },
                    idType: { id: data.idTypeId },
                    idNumber: data.idNumber,
                    firstName: data.firstName ?? data.businessName?.split(' ')[0] ?? 'S/N',
                    lastName: data.lastName ?? data.businessName?.split(' ').slice(1).join(' ') ?? 'S/N',
                    isActive: true,
                    contacts: data.mainEmail && emailContactType
                        ? [{
                            contactType: { id: emailContactType.id },
                            value: data.mainEmail,
                            isPrimary: true,
                        }]
                        : [],
                });

                customer = await this.customerRepo.save(newCustomer);
                somethingWasCreated = true;
                logger.log(`Cliente mínimo creado id: ${customer.id}`);
            }

            // ── Vincular customer ↔ billingData ───────────────────────────
            const alreadyLinked = await this.pivotRepo.findOne({
                where: {
                    customer: { id: customer.id },
                    billingData: { id: billingSaved.id },
                },
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

            // ── Retornar resultado completo ───────────────────────────────
            const result = await this.billingRepo.findOne({
                where: { id: billingSaved.id },
                relations: { idType: true, personType: true, customerLinks: { customer: true } },
            });

            if (somethingWasCreated) {
                try {
                    await this.broadcast.publishClientBillingCreated(result);
                } catch (eventError) {
                    console.error('Error publicando evento CLIENT_CREATED:', eventError);
                }
            } else {
                logger.log(`Todo ya existía, evento no publicado para idNumber: ${data.idNumber}`);
            }

            return result;

        } catch (error) {
            logger.error(error);
            if (error instanceof RpcException) throw error;
            throw new RpcException(
                new InternalServerErrorException('Error procesando billing desde legacy'),
            );
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
}