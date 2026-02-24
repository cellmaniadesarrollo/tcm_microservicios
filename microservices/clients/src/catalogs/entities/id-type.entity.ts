import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('id_types')
export class IdType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  name: string; // DNI, PASSPORT, RUC
}
