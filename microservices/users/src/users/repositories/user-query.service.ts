// users/src/repositories/user-query.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserResponseDto, EmployeeInfoDto } from '../dto/user-response.dto';

@Injectable()
export class UserQueryService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}
 
  async findAllForApi(): Promise<UserResponseDto[]> {
    const users = await this.repo.find({
      select: ['id', 'name_user', 'email_user', 'state_user', 'createdAt', 'updatedAt'],
      relations: ['employee']  // ✅ ¡Esto es lo que falta!
    });
    
    return users.map(user => {
      let employeeInfo: EmployeeInfoDto | undefined = undefined;
      
      if (user.employee) {
        employeeInfo = {
          firstName: user.employee.first_name1,
          lastName: user.employee.last_name1,
          fullName: `${user.employee.first_name1} ${user.employee.last_name1}`.trim(),
          dni: user.employee.dni
        };
      }
      
      return {
        id: user.id,
        name: user.name_user,
        email: user.email_user,
        isActive: user.state_user,
        createdAt: user.createdAt ? user.createdAt.toISOString() : new Date().toISOString(),
        updatedAt: user.updatedAt ? user.updatedAt.toISOString() : new Date().toISOString(),
        employee: employeeInfo
      };
    });
  }

  async findByNameWithPasswordAndRelations(
    name_user: string,
  ): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.password_user')
      .leftJoinAndSelect('user.userGroups', 'userGroup')
      .leftJoinAndSelect('userGroup.group', 'group')
      .leftJoinAndSelect('user.company', 'company')
      .leftJoinAndSelect('company.branches', 'branch', 'branch.status = true')
      .leftJoinAndSelect('user.employee', 'employee')  // ✅ También agregar aquí
      .where('user.name_user = :name_user', { name_user })
      .andWhere('user.state_user = true')
      .getOne();
  }
}