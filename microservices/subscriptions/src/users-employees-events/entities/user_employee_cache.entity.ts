import {
  Entity,
  PrimaryGeneratedColumn,
  Column, 
  ManyToOne,
  JoinColumn,
} from 'typeorm'; 
import { CompanyReplica } from '../../companies/entities/company-replica.entity';

@Entity('user_employee_cache')
export class UserEmployeeCache {
  @PrimaryGeneratedColumn('uuid')
  id: string;    
  // 🔗 Usuario pertenece a UNA compañía
  @ManyToOne(() => CompanyReplica, company => company.users, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'company_id' })
  company: CompanyReplica; 

  @Column({ type: 'timestamp', nullable: true })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  updatedAt: Date;
}
