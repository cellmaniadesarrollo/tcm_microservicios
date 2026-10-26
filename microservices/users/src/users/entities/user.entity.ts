import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Employee } from './employee.entity';
import { UserGroup } from './user_group.entity';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name_user!: string;

  @Column({ select: false })
  @Exclude()
  password_user!: string;

  @Column({ type: 'boolean', default: true })
  state_user!: boolean;

  // 🔐 Si es true, las operaciones sensibles piden PIN para identificar al firmante
  @Column({ type: 'boolean', default: false, name: 'pin_required' })
  pinRequired!: boolean;

  @Column({ unique: true })
  email_user!: string;
  // 🔗 Usuario pertenece a UNA compañía
  @ManyToOne(() => CompanyReplica, {
    nullable: false,
    onDelete: 'RESTRICT', // evita borrar company con users
  })
  @JoinColumn({ name: 'company_id' })
  company!: CompanyReplica;

  @OneToOne(() => Employee, employee => employee.user)
  employee!: Employee;

  @OneToMany(() => UserGroup, userGroup => userGroup.user)
  userGroups!: UserGroup[];

  // 🔥🔥 TIMESTAMPS PARA SINCRONIZACIÓN 🔥🔥

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}