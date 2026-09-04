import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { DataSource, In, MoreThan, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { UserQueryService } from './repositories/user-query.service';
import { LoginResponseDto, LoginUserDto } from './dto/login-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { Employee } from './entities/employee.entity';
import { Gender } from './entities/gender.entity';
import { Group } from './entities/group.entity';
import { UserGroup } from './entities/user_group.entity';
import { RpcException } from '@nestjs/microservices';
import { BroadcastService } from '../broadcast/broadcast.service';
import { BranchReplica } from '../companies/entities/branch-replica.entity';

@Injectable()
export class UsersService {
  constructor(
    private readonly userQueryService: UserQueryService,
    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(Employee)
    private employeeRepo: Repository<Employee>,

    @InjectRepository(Gender)
    private genderRepo: Repository<Gender>,

    @InjectRepository(Group)
    private groupRepo: Repository<Group>,

    @InjectRepository(UserGroup)
    private userGroupRepo: Repository<UserGroup>,

    @InjectRepository(BranchReplica)
    private readonly branchReplicaRepository: Repository<BranchReplica>,

    private readonly broadcast: BroadcastService,
    private readonly dataSource: DataSource,
  ) { }

  // ===============================================
  // 🧰 Helper central de manejo de errores para RPC
  // ===============================================
  /**
   * Convierte cualquier error (HttpException de Nest, error de Postgres,
   * o error genérico/desconocido) al formato RpcException que espera
   * el interceptor del gateway.
   */
  private handleRpcError(error: any, defaultMessage: string): never {
    // Ya viene como RpcException (por ejemplo relanzada desde otra capa)
    if (error instanceof RpcException) {
      throw error;
    }

    // Violación de restricción única de Postgres (23505)
    if (error?.code === '23505') {
      const detail: string = error.detail || '';

      if (detail.includes('email_user')) {
        throw new RpcException(
          new ConflictException('El correo electrónico ya está en uso').getResponse(),
        );
      }
      if (detail.includes('name_user')) {
        throw new RpcException(
          new ConflictException('El nombre de usuario ya está en uso').getResponse(),
        );
      }
      if (detail.includes('dni')) {
        throw new RpcException(
          new ConflictException('La cédula/DNI ya está registrada').getResponse(),
        );
      }
      if (detail.includes('email_personal')) {
        throw new RpcException(
          new ConflictException('El correo personal ya está registrado').getResponse(),
        );
      }

      throw new RpcException(
        new ConflictException('Ya existe un registro con esos datos').getResponse(),
      );
    }

    // Cualquier excepción de Nest ya lanzada a propósito
    // (NotFoundException, ConflictException, UnauthorizedException, etc.)
    if (error instanceof HttpException) {
      throw new RpcException(error.getResponse());
    }

    // Error desconocido / de infraestructura
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    throw new RpcException(
      new InternalServerErrorException(`${defaultMessage}: ${errorMessage}`).getResponse(),
    );
  }

  findAll(): Promise<UserResponseDto[]> {
    try {
      return this.userQueryService.findAllForApi();
    } catch (error) {
      this.handleRpcError(error, 'Error al obtener la lista de usuarios');
    }
  }

  async create(createUserDto: CreateUserDto): Promise<any> {
    const {
      name_user,
      password_user,
      email_user,
      first_name1,
      first_name2,
      last_name1,
      last_name2,
      dni,
      birthdate,
      date_of_admission,
      email_personal,
      email_business,
      addres,
      phone_personal,
      phone_business,
      gender_id,
      group_ids,
      user: createdByUser,
    } = createUserDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // ===============================================
      // 🔎 0) Verificar correo duplicado ANTES de crear nada
      //     (incluye el caso: el correo pertenece al admin de la
      //     empresa, reconocible porque no tiene `employee` asociado)
      // ===============================================
      const existingUser = await queryRunner.manager.findOne(User, {
        where: { email_user },
        relations: { employee: true },
      });

      if (existingUser) {
        const isCompanyAdminEmail = !existingUser.employee;
        throw new ConflictException(
          isCompanyAdminEmail
            ? 'Ese correo pertenece al usuario administrador de la empresa, usa uno distinto'
            : 'El correo electrónico ya está en uso por otro usuario',
        );
      }

      // ===============================================
      // 🟦 1) Crear el usuario
      // ===============================================
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password_user, saltRounds);

      const user = queryRunner.manager.create(User, {
        name_user,
        password_user: hashedPassword,
        email_user,
        company: { id: createdByUser.companyId },
      });
      await queryRunner.manager.save(user);

      // ===============================================
      // 🟩 2) Crear el empleado y vincularlo al usuario
      // ===============================================
      const gender = await queryRunner.manager.findOneBy(Gender, { id: gender_id });
      if (!gender) {
        throw new NotFoundException('El género seleccionado no existe');
      }

      const employee = queryRunner.manager.create(Employee, {
        first_name1,
        first_name2,
        last_name1,
        last_name2,
        dni,
        birthdate,
        date_of_admission,
        email_personal,
        email_business,
        addres,
        phone_personal,
        phone_business,
        gender,
        user, // 🔥 Relación 1:1 aquí
      });
      await queryRunner.manager.save(employee);

      // ===============================================
      // 🟧 3) Asignar grupos del usuario (UserGroup)
      // ===============================================
      const groups = await queryRunner.manager.findBy(Group, { id: In(group_ids) });
      if (groups.length !== group_ids.length) {
        throw new NotFoundException('Uno o más grupos seleccionados no existen');
      }

      const userGroups = groups.map(group =>
        queryRunner.manager.create(UserGroup, { user, group }),
      );
      await queryRunner.manager.save(userGroups);

      // ===============================================
      // 🟪 4) Consultar el paquete completo (employee + user + groups)
      // ===============================================
      const fullData = await queryRunner.manager.findOne(User, {
        where: { id: user.id },
        relations: {
          company: true,
          employee: { gender: true },
          userGroups: { group: true },
        },
      });

      await queryRunner.commitTransaction();

      // ===============================================
      // 🟥 5) Publicar evento en Redis / microservicios
      //     (fuera de la transacción: si el broadcast falla,
      //     no queremos revertir la creación del usuario)
      // ===============================================
      await this.broadcast.publishUserCreated(fullData);

      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.handleRpcError(error, 'Error al crear el usuario');
    } finally {
      await queryRunner.release();
    }
  }

  async validateUser(loginUserDto: LoginUserDto): Promise<LoginResponseDto> {
    try {
      const { username, password, latitude, longitude } = loginUserDto;

      // 1. Buscar usuario
      const user = await this.userQueryService.findByNameWithPasswordAndRelations(username);

      if (!user) {
        throw new UnauthorizedException('Usuario no encontrado o inactivo');
      }

      // 2. Validar contraseña
      const passwordMatches = await bcrypt.compare(password, user.password_user);

      if (!passwordMatches) {
        throw new UnauthorizedException('Contraseña incorrecta');
      }

      // 3. Resolver sucursal
      const branch = await this.resolveBranch(
        user.company.id,
        latitude || 0,
        longitude || 0,
      );

      // 4. Retornar respuesta exitosa
      return {
        id: user.id,
        name: user.name_user,
        email: user.email_user,
        groups: user.userGroups.map(ug => ({
          id: ug.group.id,
          name: ug.group.name,
        })),
        company: {
          id: user.company.id,
          name: user.company.name,
        },
        branch,
      };
    } catch (error) {
      this.handleRpcError(error, 'Error interno en la autenticación');
    }
  }

  // 👇 Helper privado para resolver sucursal por cercanía geográfica
  private async resolveBranch(
    companyId: string,
    latitude: number,
    longitude: number,
  ): Promise<{ id: string; name: string } | null> {
    const RADIUS_METERS = 2000;

    // 1️⃣ Intenta encontrar una sucursal cercana al usuario
    const nearby = await this.branchReplicaRepository
      .createQueryBuilder('branch')
      .innerJoin('branch.company', 'company')
      .where('company.id = :companyId', { companyId })
      .andWhere('branch.status = true')
      .andWhere('branch.location IS NOT NULL')
      .andWhere(
        `ST_DWithin(
          branch.location,
          ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
          :radius
        )`,
        { longitude, latitude, radius: RADIUS_METERS },
      )
      .orderBy(
        `ST_Distance(
          branch.location,
          ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography
        )`,
        'ASC',
      )
      .setParameters({ longitude, latitude })
      .getOne();

    if (nearby) {
      return { id: nearby.id, name: nearby.name };
    }

    // 2️⃣ Fallback: asignar la sucursal principal (primera en orden alfanumérico)
    const principal = await this.branchReplicaRepository
      .createQueryBuilder('branch')
      .innerJoin('branch.company', 'company')
      .where('company.id = :companyId', { companyId })
      .andWhere('branch.status = true')
      .orderBy('branch.name', 'ASC')
      .getOne();

    if (!principal) return null;

    return { id: principal.id, name: principal.name };
  }

  async findFullDataByCreatedAfter(date: Date | null): Promise<any[]> {
    try {
      return await this.userRepo.find({
        where: date ? { updatedAt: MoreThan(date) } : {},
        relations: {
          company: true,
          employee: true,
          userGroups: {
            group: true,
          },
        },
      });
    } catch (error) {
      this.handleRpcError(error, 'Error al obtener usuarios actualizados');
    }
  }

  // ⚠️ NOTA: la lógica de creación de compañía/admin se moverá a otro
  // microservicio con una implementación específica más adelante.
  // Por ahora solo se homogeniza el manejo de errores.
  async createCompanyAdmin(company: any) {
    try {
      const existingUser = await this.userRepo.findOne({
        where: { email_user: company.email },
      });

      if (existingUser) {
        console.warn('⚠️ Usuario admin ya existe para esta empresa');
        return;
      }

      // 🔐 password temporal (nombre empresa)
      const tempPassword = company.name.toLowerCase().replace(/\s+/g, '');
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // 🔎 buscar grupo COMPANY_ADMIN
      const group = await this.groupRepo.findOne({
        where: { name: 'COMPANY_ADMIN' },
      });

      if (!group) {
        throw new NotFoundException('Grupo COMPANY_ADMIN no existe');
      }

      // 👤 crear usuario
      const user = this.userRepo.create({
        name_user: `${company.name}_admin`,
        email_user: company.email,
        password_user: hashedPassword,
        state_user: true,
        company: { id: company.id },
      });

      const savedUser = await this.userRepo.save(user);

      // 🔗 relación user → group
      const userGroup = this.userGroupRepo.create({
        user: savedUser,
        group,
      });

      await this.userGroupRepo.save(userGroup);

      const fullData = await this.userRepo.findOne({
        where: { id: user.id },
        relations: {
          company: true,
          employee: {
            gender: true,
          },
          userGroups: {
            group: true,
          },
        },
      });

      await this.broadcast.publishUserCreated(fullData);
      // 📩 aquí luego envías token por email
    } catch (error) {
      this.handleRpcError(error, 'Error al crear el administrador de la empresa');
    }
  }

  async findByCompany(companyId: string): Promise<User[]> {
    try {
      return await this.userRepo.find({
        where: {
          company: { id: companyId },
          state_user: true,
        },
        relations: ['company'],
        select: ['id', 'name_user', 'email_user', 'state_user'],
      });
    } catch (error) {
      this.handleRpcError(error, 'Error al obtener usuarios de la compañía');
    }
  }
}