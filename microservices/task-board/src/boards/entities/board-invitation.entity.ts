// boards/entities/board-invitation.entity.ts
import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired'
}

@Entity('board_invitations')
export class BoardInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'board_id' })
  boardId: string;

  @Column({ name: 'invited_user_id' })
  invitedUserId: string;

  @Column({ name: 'invited_by' })
  invitedBy: string;

  @Column({ name: 'role_name', nullable: true })
  roleName: string;

  @Column({ 
    type: 'enum', 
    enum: InvitationStatus, 
    default: InvitationStatus.PENDING 
  })
  status: InvitationStatus;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}