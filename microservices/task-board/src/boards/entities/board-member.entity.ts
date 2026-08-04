// boards/entities/board-member.entity.ts
import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany
} from 'typeorm';
import { Board } from './board.entity';
import { Role } from './role.entity';
import { CustomPermission } from './custom-permission.entity';

@Entity('board_members')
export class BoardMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'board_id' })
  boardId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'role_id', nullable: true })
  roleId: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  @Column({ name: 'invited_by', nullable: true })
  invitedBy: string;

  // Relaciones
  @ManyToOne(() => Board, board => board.members)
  @JoinColumn({ name: 'board_id' })
  board: Board;

  @ManyToOne(() => Role, role => role.members)
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @OneToMany(() => CustomPermission, permission => permission.member)
  customPermissionsList: CustomPermission[];
}