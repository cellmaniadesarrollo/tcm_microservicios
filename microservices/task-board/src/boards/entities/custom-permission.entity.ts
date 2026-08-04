// boards/entities/custom-permission.entity.ts
import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { BoardMember } from './board-member.entity';

@Entity('custom_permissions')
export class CustomPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'member_id' })
  memberId: string;

  @Column({ name: 'permission_key' })
  permissionKey: string;

  @Column({ default: true })
  value: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => BoardMember, member => member.customPermissionsList)
  @JoinColumn({ name: 'member_id' })
  member: BoardMember;
}