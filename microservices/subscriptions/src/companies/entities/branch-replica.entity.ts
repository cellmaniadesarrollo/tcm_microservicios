import {
  Entity,
  PrimaryColumn, 
  ManyToOne, 
} from 'typeorm';
import { CompanyReplica } from './company-replica.entity';

@Entity('branches_replica')
export class BranchReplica {
  @PrimaryColumn('uuid')
  id: string;
  @ManyToOne(() => CompanyReplica, company => company.branches, {
    onDelete: 'CASCADE',
  })
  company: CompanyReplica;

 
}

