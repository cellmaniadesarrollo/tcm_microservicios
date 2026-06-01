//microservices\orders\src\companies\entities\company-replica.entity.ts
import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
//import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity'
@Entity('companies_replica')
export class CompanyReplica {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ default: true })
  status!: boolean;

  @Column({ type: 'int', default: 5 })
  maxUsers!: number;



  // ⏱️ Fechas replicadas, NO generadas
  @Column({ type: 'timestamp', nullable: true })
  createdAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  updatedAt!: Date;


  // @OneToMany(() => UserEmployeeCache, user => user.company)
  // users: UserEmployeeCache[];
} 