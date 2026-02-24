import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Gender } from './gender.entity';
import { User } from './user.entity';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  first_name1: string;

  @Column({ nullable: true })
  first_name2: string;

  @Column()
  last_name1: string;

  @Column({ nullable: true })
  last_name2: string;

  @Column({ unique: true })
  dni: string;

  @Column()
  birthdate: string;

  @Column()
  date_of_admission: string;

  @Column({ unique: true })
  email_personal: string;

  @Column()
  email_business: string;

  @Column()
  addres: string;

  @Column()
  phone_personal: string;

  @Column()
  phone_business: string;

  @ManyToOne(() => Gender, gender => gender.employees)
  gender: Gender;

  // 🔵 Dueña de la relación (tendrá la FK user_id)
  @OneToOne(() => User, user => user.employee, { onDelete: 'CASCADE' })
  @JoinColumn() // <-- Genera la FK en esta tabla
  user: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
