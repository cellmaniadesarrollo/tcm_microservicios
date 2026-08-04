//microservices\orders\src\users-employees-events\entities\group_cache.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEmployeeCache } from './user_employee_cache.entity';

@Entity('group_cache')
export class GroupCache {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  group_name!: string;

  // Cada grupo pertenece a un único empleado
  @ManyToOne(() => UserEmployeeCache, employee => employee.groups)
  employee!: UserEmployeeCache;


}
