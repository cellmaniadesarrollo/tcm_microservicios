import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, BeforeInsert, BeforeUpdate } from 'typeorm';
import { Customer } from './customer.entity';
import { City } from '../../catalogs/entities/city.entity';

@Entity('customer_addresses')
export class Address {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Customer, (customer) => customer.addresses, { onDelete: 'CASCADE' })
  customer: Customer;

  @ManyToOne(() => City, { eager: true, nullable: true })
  city: City;

  @Column({ type: 'varchar', length: 50, nullable: true })
  zone: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sector: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  locality: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  mainStreet: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  secondaryStreet: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  postalCode: string;

@BeforeInsert()
@BeforeUpdate()
normalizeFields() {
  this.zone = this.zone?.trim().toUpperCase();
  this.sector = this.sector?.trim().toUpperCase();
  this.locality = this.locality?.trim().toUpperCase();
  this.mainStreet = this.mainStreet?.trim().toUpperCase();
  this.secondaryStreet = this.secondaryStreet?.trim().toUpperCase();
  this.reference = this.reference?.trim().toUpperCase();
}
}
