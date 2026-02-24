import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('resources')
export class Resource {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string; // users | branches

  @Column()
  name: string;

  @Column({ default: true })
  active: boolean;
}
