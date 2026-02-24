import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('genders')
export class Gender {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  name: string; // MALE, FEMALE, OTHER
}
