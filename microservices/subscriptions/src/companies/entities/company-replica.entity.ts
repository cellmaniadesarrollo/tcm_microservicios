import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany, 
} from 'typeorm';
import { BranchReplica } from './branch-replica.entity';
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity'
@Entity('companies_replica')
export class CompanyReplica {
  @PrimaryColumn('uuid')
  id: string;


  @Column({ default: true })
  status: boolean;

  @OneToMany(() => BranchReplica, branch => branch.company, {
    cascade: true,
  })
  branches: BranchReplica[];

  // ⏱️ Fechas replicadas, NO generadas
  @Column({ type: 'timestamp', nullable: true })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  updatedAt: Date;
  @OneToMany(() => UserEmployeeCache, user => user.company)
  users: UserEmployeeCache[];
} 