import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('features')
export class Feature {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string; // users | branches | inventory

  @Column()
  name: string;

  @Column({ default: true })
  active: boolean;
}
