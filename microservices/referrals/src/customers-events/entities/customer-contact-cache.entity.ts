import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { CustomerCache } from './customer-cache.entity';

@Entity('contacts_cache')
export class CustomerContactCache {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CustomerCache, (customer) => customer.contacts, {
    onDelete: 'CASCADE',
  })
  customer: CustomerCache;

  @Column({ type: 'varchar', length: 100 })
  typeName: string; // Ej: "MÓVIL", "EMAIL", "TRABAJO"

  @Column({ type: 'varchar', length: 150 })
  value: string; // el número, email, whatsapp, etc.    

  @Column({ type: 'boolean', default: false })
  isPrimary: boolean;

}