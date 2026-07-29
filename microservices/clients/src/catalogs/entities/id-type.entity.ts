import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('id_types')
export class IdType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  name: string; // CÉDULA, PASAPORTE, RUC, CONSUMIDOR FINAL, IDENTIFICACIÓN DEL EXTERIOR

  @Column({ type: 'varchar', length: 10, unique: true, nullable: true }) // temporal
  code: string;// 04, 05, 06, 07, 08 (códigos SRI)

  @Column({ type: 'boolean', default: true })
  allowsBilling: boolean;

  @Column({ type: 'boolean', default: false })
  isForCompany: boolean; // true solo para RUC
}