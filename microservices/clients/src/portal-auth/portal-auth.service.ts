import {
    BadRequestException,
    ConflictException,
    Injectable,
    InternalServerErrorException,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcrypt';
import { PortalUser } from './entities/portal-user.entity';
import { UserCustomerLink } from './entities/user-customer-link.entity';
import { Customer } from '../customers/entities/customer.entity';
import { RegisterPortalUserDto } from './dto/portal-auth.dto';
import { LoginPortalUserDto } from './dto/portal-auth.dto';

@Injectable()
export class PortalAuthService {
    private readonly logger = new Logger(PortalAuthService.name);

    constructor(
        @InjectRepository(PortalUser)
        private readonly portalUserRepo: Repository<PortalUser>,

        @InjectRepository(UserCustomerLink)
        private readonly linkRepo: Repository<UserCustomerLink>,

        @InjectRepository(Customer)
        private readonly customerRepo: Repository<Customer>,
    ) { }

    // ─────────────────────────────────────────────
    // REGISTRO
    // ─────────────────────────────────────────────

    async register(dto: RegisterPortalUserDto) {
        try {
            // 1️⃣ Validaciones básicas
            if (!dto.email || !dto.password || !dto.idNumber) {
                throw new RpcException(
                    new BadRequestException('email, password e idNumber son requeridos'),
                );
            }

            // 2️⃣ Verificar que el email no esté en uso
            const existingUser = await this.portalUserRepo.findOne({
                where: { email: dto.email.trim().toLowerCase() },
            });
            if (existingUser) {
                throw new RpcException(
                    new ConflictException('Ya existe una cuenta con este email'),
                );
            }

            // 3️⃣ Verificar que exista al menos un Customer con ese idNumber
            const matchingCustomers = await this.customerRepo.find({
                where: { idNumber: dto.idNumber.trim().toUpperCase(), isActive: true },
                relations: ['company'],
            });

            if (matchingCustomers.length === 0) {
                throw new RpcException(
                    new BadRequestException(
                        'No se encontró ningún cliente registrado con ese número de identificación',
                    ),
                );
            }

            // 4️⃣ Hash de contraseña
            const passwordHash = await bcrypt.hash(dto.password, 10);

            // 5️⃣ Crear usuario
            const portalUser = this.portalUserRepo.create({
                email: dto.email,
                passwordHash,
                idNumber: dto.idNumber,
            });
            const savedUser = await this.portalUserRepo.save(portalUser);

            // 6️⃣ Vincular automáticamente con todos los Customer que coincidan
            await this.linkUserToCustomers(savedUser, matchingCustomers);

            // 7️⃣ Retornar usuario con sus vínculos
            return await this.getUserWithLinks(savedUser.id);

        } catch (error) {
            if (error instanceof QueryFailedError) {
                const driverError: any = error.driverError;
                if (driverError?.code === '23505') {
                    throw new RpcException(
                        new ConflictException('Ya existe una cuenta con este email'),
                    );
                }
            }
            if (error instanceof RpcException) throw error;

            this.logger.error('Error en register', error);
            throw new RpcException(
                new InternalServerErrorException('Error al registrar el usuario'),
            );
        }
    }

    // ─────────────────────────────────────────────
    // LOGIN
    // ─────────────────────────────────────────────

    async login(dto: LoginPortalUserDto) {
        try {
            if (!dto.email || !dto.password) {
                throw new RpcException(
                    new BadRequestException('email y password son requeridos'),
                );
            }

            // 1️⃣ Buscar usuario activo
            const portalUser = await this.portalUserRepo.findOne({
                where: { email: dto.email.trim().toLowerCase(), isActive: true },
            });

            if (!portalUser) {
                throw new RpcException(
                    new UnauthorizedException('Credenciales inválidas'),
                );
            }

            // 2️⃣ Verificar contraseña
            const isPasswordValid = await bcrypt.compare(dto.password, portalUser.passwordHash);
            if (!isPasswordValid) {
                throw new RpcException(
                    new UnauthorizedException('Credenciales inválidas'),
                );
            }

            // 3️⃣ Retornar usuario con sus vínculos (empresas donde es cliente)
            return await this.getUserWithLinks(portalUser.id);

        } catch (error) {
            if (error instanceof RpcException) throw error;

            this.logger.error('Error en login', error);
            throw new RpcException(
                new InternalServerErrorException('Error al iniciar sesión'),
            );
        }
    }

    // ─────────────────────────────────────────────
    // HELPERS PRIVADOS
    // ─────────────────────────────────────────────

    /**
     * Crea un UserCustomerLink por cada Customer que coincida con el idNumber.
     * Ignora duplicados silenciosamente (por si ya existiera algún link previo).
     */
    private async linkUserToCustomers(
        portalUser: PortalUser,
        customers: Customer[],
    ): Promise<void> {
        const links = customers.map((customer) =>
            this.linkRepo.create({ portalUser, customer }),
        );

        // insertOrIgnore pattern: si ya existe el link, no falla
        await this.linkRepo
            .createQueryBuilder()
            .insert()
            .into(UserCustomerLink)
            .values(links)
            .orIgnore()
            .execute();
    }

    /**
     * Retorna el usuario con todos sus vínculos de empresa.
     * Excluye el passwordHash de la respuesta.
     */
    private async getUserWithLinks(userId: number) {
        const user = await this.portalUserRepo.findOne({
            where: { id: userId },
            relations: {
                customerLinks: {
                    customer: {
                        company: true,
                        contacts: true,
                        addresses: true,
                    },
                },
            },
        });

        if (!user) {
            throw new RpcException(
                new InternalServerErrorException('Error al cargar el usuario'),
            );
        }

        // No exponer el hash
        const { passwordHash, ...safeUser } = user as any;
        return safeUser;
    }
}