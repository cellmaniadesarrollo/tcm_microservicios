import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BranchReplica } from './branch-replica.entity';
import {User} from '../../users/entities/user.entity'
@Entity('companies_replica')
export class CompanyReplica {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ default: true })
  status: boolean;

  @Column({ type: 'int', default: 5 })
  maxUsers: number;

  @OneToMany(() => BranchReplica, branch => branch.company, {
    cascade: true,
  })
  branches: BranchReplica[];

  // ⏱️ Fechas replicadas, NO generadas
  @Column({ type: 'timestamp', nullable: true })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  updatedAt: Date;
  @OneToMany(() => User, user => user.company)
users: User[];
} 