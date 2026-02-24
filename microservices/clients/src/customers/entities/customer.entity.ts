import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  BeforeInsert,
  BeforeUpdate,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Contact } from './contact.entity';
import { Address } from './address.entity';
import { Billing } from '../../billing/entities/billing.entity';
import { IdType } from '../../catalogs/entities/id-type.entity';
import { Gender } from '../../catalogs/entities/gender.entity';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';

@Index(['company', 'idNumber'], { unique: true })
@Entity('customers')
export class Customer {

  @PrimaryGeneratedColumn()
  id: number;

  // 🔗 Solo relación por ID (CompanyReplica)
  @ManyToOne(() => CompanyReplica, { eager: true, nullable: false })
  company: CompanyReplica;

  @ManyToOne(() => IdType, { eager: true })
  idType: IdType;

  @Column({ type: 'varchar', length: 30 })
  idNumber: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'date', nullable: true })
  birthDate: Date;

  @ManyToOne(() => Gender, { eager: true, nullable: true })
  gender: Gender;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Contact, (contact) => contact.customer, { cascade: true })
  contacts: Contact[];

  @OneToMany(() => Address, (address) => address.customer, { cascade: true })
  addresses: Address[];

  @OneToMany(() => Billing, (billing) => billing.customer)
  billings: Billing[];

  @BeforeInsert()
  @BeforeUpdate()
  normalizeFields() {
    this.firstName = this.firstName?.trim().toUpperCase();
    this.lastName = this.lastName?.trim().toUpperCase();
  }

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
