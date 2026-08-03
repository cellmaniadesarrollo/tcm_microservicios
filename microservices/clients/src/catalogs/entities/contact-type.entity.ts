import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('contact_types')
export class ContactType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  name: string; // MOBILE, EMAIL, PHONE, OTHER
}

