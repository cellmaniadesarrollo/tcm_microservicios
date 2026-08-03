import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, BeforeInsert, BeforeUpdate } from 'typeorm';
import { Customer } from './customer.entity';
import { ContactType } from '../../catalogs/entities/contact-type.entity';

@Entity('customer_contacts')
export class Contact {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Customer, (customer) => customer.contacts, { onDelete: 'CASCADE' })
  customer: Customer;

  @ManyToOne(() => ContactType, { eager: true })
  contactType: ContactType;

  @Column({ type: 'varchar', length: 100 })
  value: string;

  @Column({ type: 'boolean', default: false })
  isPrimary: boolean;

  @BeforeInsert()
  @BeforeUpdate()
  normalizeFields() {
    this.value = this.value?.trim().toUpperCase();
  }
}
