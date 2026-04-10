//microservices\clients\src\billing\entities\billing-data.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany,
  BeforeInsert, BeforeUpdate,
  CreateDateColumn, UpdateDateColumn,
  Index,
} from 'typeorm';
import { IdType } from '../../catalogs/entities/id-type.entity';
import { Gender } from '../../catalogs/entities/gender.entity';
import { PersonType } from '../../catalogs/entities/person-type.entity'; // ← NUEVO
import { CustomerBillingData } from './customer-billing-data.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';

@Index(['company', 'idNumber'], { unique: true })
@Entity('billing_data')
export class BillingData {

  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CompanyReplica, { eager: true, nullable: false })
  company: CompanyReplica;

  @ManyToOne(() => IdType, { eager: true, nullable: false })
  idType: IdType;

  // ← REMOVIDO: identificationCode (ya lo tienes normalizado en la tabla IdType)

  @Column({ type: 'varchar', length: 30 })
  idNumber: string;

  @Column({ type: 'varchar', length: 100, })
  firstName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName: string;


  @Column({ type: 'varchar', length: 200, nullable: true })
  tradeName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cellphone: string;

  @Column({ type: 'varchar', length: 150 })
  mainEmail: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  birthdate: string;

  @ManyToOne(() => Gender, { eager: true, nullable: true })
  gender: Gender;

  // ← NUEVO: ahora es una relación (igual que Gender o IdType)
  @ManyToOne(() => PersonType, { eager: true, nullable: false })
  personType: PersonType;

  @Column({ type: 'varchar', length: 300 })
  address: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  @Column({ type: 'boolean', default: false })
  isCompanyClient: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => CustomerBillingData, (cbd) => cbd.billingData)
  customerLinks: CustomerBillingData[];

  @ManyToOne(() => Customer, (customer) => customer.billings, { nullable: true })
  customer: Customer;

  @BeforeInsert()
  @BeforeUpdate()
  normalizeFields() {
    this.tradeName = this.tradeName?.trim().toUpperCase();
    this.mainEmail = this.mainEmail?.trim().toLowerCase();
    this.address = this.address?.trim().toUpperCase();
    this.city = this.city?.trim().toUpperCase();
    this.idNumber = this.idNumber?.trim();
    this.firstName = this.firstName?.trim().toUpperCase();
    this.lastName = this.lastName?.trim().toUpperCase();
    this.cellphone = this.cellphone?.trim();
  }

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}