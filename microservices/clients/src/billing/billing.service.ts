import {
    BadRequestException, ForbiddenException,
    Injectable, InternalServerErrorException, Logger,
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
                businessName: data.businessName,
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
                order: { businessName: 'ASC' },
                take: 10,
            });

        } catch (error) {
            if (error instanceof RpcException) throw error;
            throw new RpcException(new InternalServerErrorException('Error al buscar datos de facturación'));
        }
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

            // ── Buscar o crear BillingData ────────────────────────────────
            const existingBilling = await this.billingRepo.findOne({
                where: {
                    idNumber: data.idNumber,
                    company: { id: data.user.companyId },
                },
            });

            let billingSaved: BillingData;

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
                    businessName: data.businessName,
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
                logger.log(`BillingData creado  id: ${billingSaved.id}`);
            }

            // ── Buscar o crear Customer mínimo ────────────────────────────
            let customer = await this.customerRepo.findOne({
                where: {
                    idNumber: data.idNumber,
                    company: { id: data.user.companyId },
                },
            });

            if (!customer) {
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
                logger.log(`Cliente mínimo creado id: ${customer.id}`);
            }

            // ── Vincular customer ↔ billingData ───────────────────────────
            const alreadyLinked = await this.pivotRepo.findOne({
                where: {
                    customer: { id: customer.id },
                    billingData: { id: billingSaved.id },
                },
            });

            if (!alreadyLinked) {
                await this.pivotRepo.save(
                    this.pivotRepo.create({
                        customer: { id: customer.id },
                        billingData: { id: billingSaved.id },
                        isDefault: false,
                    }),
                );
                logger.log(`Vínculo creado customer ${customer.id} ↔ billing ${billingSaved.id}`);
            }

            // ── Retornar resultado completo ───────────────────────────────
            const customerBillingWithRelations = await this.billingRepo.findOne({
                where: { id: billingSaved.id },
                relations: { idType: true, personType: true, customerLinks: { customer: true } },
            });
            try {
                await this.broadcast.publishClientBillingCreated(customerBillingWithRelations);
            } catch (eventError) {
                console.error('Error publicando evento CLIENT_CREATED:', eventError);
            }
            return customerBillingWithRelations
        } catch (error) {
            logger.error(error);
            if (error instanceof RpcException) throw error;
            throw new RpcException(
                new InternalServerErrorException('Error procesando billing desde legacy'),
            );
        }
    }
}