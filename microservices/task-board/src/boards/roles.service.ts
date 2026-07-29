// boards/roles.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, RoleType } from './entities/role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  // Crear roles por defecto
  async createDefaultRoles(): Promise<void> {
    const defaultRoles = [
      {
        name: 'Admin',
        type: RoleType.ADMIN,
        permissions: {
          canCreateBoard: true,
          canEditBoard: true,
          canDeleteBoard: true,
          canArchiveBoard: true,
          canCreateTasks: true,
          canEditTasks: true,
          canDeleteTasks: true,
          canAssignTasks: true,
          canMoveTasks: true,
          canManageMembers: true,
          canInviteMembers: true,
          canRemoveMembers: true,
          canChangeRoles: true,
          canCreateColumns: true,
          canEditColumns: true,
          canDeleteColumns: true,
          canCreateLabels: true,
          canEditLabels: true,
          canDeleteLabels: true,
        },
        description: 'Full access to everything',
      },
      {
        name: 'Member',
        type: RoleType.MEMBER,
        permissions: {
          canCreateBoard: false,
          canEditBoard: false,
          canDeleteBoard: false,
          canArchiveBoard: false,
          canCreateTasks: true,
          canEditTasks: true,
          canDeleteTasks: false,
          canAssignTasks: true,
          canMoveTasks: true,
          canManageMembers: false,
          canInviteMembers: false,
          canRemoveMembers: false,
          canChangeRoles: false,
          canCreateColumns: false,
          canEditColumns: false,
          canDeleteColumns: false,
          canCreateLabels: true,
          canEditLabels: true,
          canDeleteLabels: false,
        },
        description: 'Can create and edit tasks, but not manage members or board settings',
      },
      {
        name: 'Viewer',
        type: RoleType.VIEWER,
        permissions: {
          canCreateBoard: false,
          canEditBoard: false,
          canDeleteBoard: false,
          canArchiveBoard: false,
          canCreateTasks: false,
          canEditTasks: false,
          canDeleteTasks: false,
          canAssignTasks: false,
          canMoveTasks: false,
          canManageMembers: false,
          canInviteMembers: false,
          canRemoveMembers: false,
          canChangeRoles: false,
          canCreateColumns: false,
          canEditColumns: false,
          canDeleteColumns: false,
          canCreateLabels: false,
          canEditLabels: false,
          canDeleteLabels: false,
        },
        description: 'Read-only access',
      },
    ];

    for (const roleData of defaultRoles) {
      const existingRole = await this.roleRepository.findOne({
        where: { name: roleData.name }
      });

      if (!existingRole) {
        const role = this.roleRepository.create(roleData);
        await this.roleRepository.save(role);
      }
    }
  }

  async findAll(): Promise<Role[]> {
    return this.roleRepository.find();
  }

  async findOne(id: string): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    return role;
  }

  async findByName(name: string): Promise<Role | null> {
    return this.roleRepository.findOne({ where: { name } });
  }

  async createRole(name: string, permissions: any, description?: string): Promise<Role> {
    const role = this.roleRepository.create({
      name,
      type: RoleType.CUSTOM,
      permissions,
      description,
    });
    return this.roleRepository.save(role);
  }

  async updateRole(id: string, updateData: Partial<Role>): Promise<Role> {
    const role = await this.findOne(id);
    Object.assign(role, updateData);
    return this.roleRepository.save(role);
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.findOne(id);
    role.isActive = false;
    await this.roleRepository.save(role);
  }
}