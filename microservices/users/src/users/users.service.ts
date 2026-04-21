import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { MoreThan, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { instanceToPlain } from 'class-transformer';
import { UserQueryService } from './repositories/user-query.service';
import { LoginResponseDto, LoginUserDto } from './dto/login-user.dto';
import { UnauthorizedException } from '@nestjs/common';
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
  ) { }

  findAll(): Promise<UserResponseDto[]> {
    try {
      return this.userQueryService.findAllForApi();
    } catch (error) {
      throw new InternalServerErrorException('Error al obtener la lista de usuarios');
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

    // 🔐 Hashear la contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password_user, saltRounds);

    // ===============================================
    // 🟦 1) Crear el usuario
    // ===============================================
    const user = this.userRepo.create({
      name_user,
      password_user: hashedPassword,
      email_user,
      company: { id: createdByUser.companyId },
    });

    await this.userRepo.save(user);

    // ===============================================
    // 🟩 2) Crear el empleado y vincularlo al usuario
    // ===============================================
    const gender = await this.genderRepo.findOneByOrFail({ id: gender_id });

    const employee = this.employeeRepo.create({
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
      user,  // 🔥 Relación 1:1 aquí
    });

    await this.employeeRepo.save(employee);

    // ===============================================
    // 🟧 3) Asignar grupos del usuario (UserGroup)
    // ===============================================
    const groups = await this.groupRepo.findByIds(group_ids);

    const userGroups = groups.map(group =>
      this.userGroupRepo.create({ user, group }),
    );

    await this.userGroupRepo.save(userGroups);

    // ===============================================
    // 🟪 4) Consultar el paquete completo (employee + user + groups)
    // ===============================================
    const fullData = await this.userRepo.findOne({
      where: { id: user.id },
      relations: {
        company: true, // 👈 relación faltante
        employee: {
          gender: true,
        },
        userGroups: {
          group: true,
        },
      },
    });

    // ===============================================
    // 🟥 5) Publicar evento en Redis / microservicios
    // ===============================================
    await this.broadcast.publishUserCreated(fullData);

    return true;
  }


  async validateUser(loginUserDto: LoginUserDto): Promise<LoginResponseDto> {
    const { username, password, latitude, longitude } = loginUserDto;

    const user =
      await this.userQueryService.findByNameWithPasswordAndRelations(username);

    if (!user) {
      throw new RpcException(
        new UnauthorizedException('Usuario no encontrado o inactivo'),
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.password_user);

    if (!passwordMatches) {
      throw new RpcException(
        new UnauthorizedException('Contraseña incorrecta'),
      );
    }

    const branch = await this.resolveBranch(
      user.company.id,
      latitude || 0,   // -2.7395
      longitude || 0,  // -78.9847
    );

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
  }

  // 👇 ESTO ES EL "HELPER" (pero es solo un método privado)
  private async resolveBranch(
    companyId: string,
    latitude: number,
    longitude: number,
  ): Promise<{ id: string; name: string } | null> {
    const RADIUS_METERS = 2000;//2000 = 2km 
    const branch = await this.branchReplicaRepository
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

    if (!branch) return null;

    return {
      id: branch.id,
      name: branch.name,
    };
  }

  async findFullDataByCreatedAfter(date: Date | null): Promise<any[]> {
    console.log(date)
    const qb = await this.userRepo.find({
      where: date
        ? { updatedAt: MoreThan(date) }
        : {},
      relations: {
        company: true,
        employee: true,
        userGroups: {
          group: true, // si aplica
        },
      },
    });
    return qb
  }


  async createCompanyAdmin(company: any) {
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
      throw new Error('Grupo COMPANY_ADMIN no existe');
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
        company: true, // 👈 relación faltante
        employee: {
          gender: true,
        },
        userGroups: {
          group: true,
        },
      },
    });
    // console.log(fullData)
    // console.log('✅ COMPANY_ADMIN creado:', savedUser.email_user);
    await this.broadcast.publishUserCreated(fullData);
    // 📩 aquí luego envías token por email
  }


}
