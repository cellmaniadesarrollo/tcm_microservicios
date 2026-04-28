import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GroupCache } from './group_cache.entity';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';

@Entity('user_employee_cache')
export class UserEmployeeCache {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Nombre de usuario
  @Column()
  username: string;

  // Datos esenciales del empleado
  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column({ type: 'varchar', nullable: true })
  dni: string;


  @Column()
  email: string;

  @Column()
  phone: string;
  // 🔗 Usuario pertenece a UNA compañía
  @ManyToOne(() => CompanyReplica, company => company.users, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'company_id' })
  company: CompanyReplica;
  // Relación: un empleado tiene varios grupos
  @OneToMany(() => GroupCache, group => group.employee, { cascade: true })
  groups: GroupCache[];

  @Column({ type: 'timestamp', nullable: true })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  updatedAt: Date;
}
