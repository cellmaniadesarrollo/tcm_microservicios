 

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserResponseDto } from '../dto/user-response.dto';

@Injectable()
export class UserQueryService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}
 
  async findAllForApi(): Promise<UserResponseDto[]> {
    return this.repo.createQueryBuilder('user')
      .select([
        'user.id AS id',
        'user.name_user AS name',
        'user.email_user AS email',
        'user.state_user AS isActive', 
        'user.created_at AS createdAt',
        'user.updated_at AS updatedAt',
      ])
      .getRawMany();
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
    .where('user.name_user = :name_user', { name_user })
    .andWhere('user.state_user = true')
    .getOne();
}

}
