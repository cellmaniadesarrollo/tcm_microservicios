import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('identification_type')
export class IdentificationType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  code: string; // Ej: CI, RUC, PASS

  @Column({ type: 'varchar', length: 100 })
  name: string; // Ej: ID CARD, TAX ID, PASSPORT
}
