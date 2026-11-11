import { Column, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('customer_cache')
export class CustomerCache {
  @PrimaryColumn({ name: 'customer_id', type: 'varchar', length: 36 })
  customerId!: string;

  @Index()
  @Column({ name: 'company_id', type: 'varchar', length: 36 })
  companyId!: string;

  @Column({ name: 'id_number', type: 'varchar', length: 20, nullable: true })
  idNumber!: string | null;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ name: 'second_name', type: 'varchar', length: 100, nullable: true })
  secondName!: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName!: string;

  @Column({ name: 'second_last_name', type: 'varchar', length: 100, nullable: true })
  secondLastName!: string | null;

  @Column({ name: 'search_text', type: 'varchar', length: 450 })
  @Index()
  searchText!: string; // nombres normalizados, minúsculas y sin tildes

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}