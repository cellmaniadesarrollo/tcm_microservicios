// companies/entities/company.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  @Column({ unique: true })
  name: string;
  @Column({ unique: true })
  email: string;
  @Column({ default: true })
  status: boolean;

  // 🔐 límite de usuarios permitidos
  @Column({ type: 'int', default: 5 })
  maxUsers: number;

  @OneToMany(() => Branch, branch => branch.company)
  branches: Branch[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
