import { Entity, PrimaryColumn, Column, OneToMany,CreateDateColumn,UpdateDateColumn, ManyToOne, Index,  } from 'typeorm';
import { CustomerContactCache } from './customer-contact-cache.entity';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';

@Index(['company', 'idNumber'], { unique: true })
@Entity('customers_cache')
export class CustomerCache {

  @PrimaryColumn()
  id: number; // ID original del MS customers

  @ManyToOne(() => CompanyReplica, { eager: true, nullable: false })
  company: CompanyReplica;

  @Column({ type: 'varchar', length: 30 })
  idNumber: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  idTypeName: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

 

  @OneToMany(
    () => CustomerContactCache,
    (contact) => contact.customer,
    { cascade: true }
  )
  contacts: CustomerContactCache[];

  @Column({ type: 'timestamp', nullable: true })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  updatedAt: Date;
}
