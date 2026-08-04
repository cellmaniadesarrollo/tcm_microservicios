// boards/entities/role.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { BoardMember } from './board-member.entity';

export enum RoleType {
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
  CUSTOM = 'custom'
}

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'enum', enum: RoleType, default: RoleType.MEMBER })
  type: RoleType;

  @Column({ type: 'jsonb', default: {} })
  permissions: {
    // Permisos de tablero
    canCreateBoard?: boolean;
    canEditBoard?: boolean;
    canDeleteBoard?: boolean;
    canArchiveBoard?: boolean;
    
    // Permisos de tareas
    canCreateTasks?: boolean;
    canEditTasks?: boolean;
    canDeleteTasks?: boolean;
    canAssignTasks?: boolean;
    canMoveTasks?: boolean;
    
    // Permisos de miembros
    canManageMembers?: boolean;
    canInviteMembers?: boolean;
    canRemoveMembers?: boolean;
    canChangeRoles?: boolean;
    
    // Permisos de columnas
    canCreateColumns?: boolean;
    canEditColumns?: boolean;
    canDeleteColumns?: boolean;
    
    // Permisos de labels
    canCreateLabels?: boolean;
    canEditLabels?: boolean;
    canDeleteLabels?: boolean;
  };

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relación con miembros
  @OneToMany(() => BoardMember, member => member.role)
  members: BoardMember[];
}