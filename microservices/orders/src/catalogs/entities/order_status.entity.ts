import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('order_statuses')
export class OrderStatus {

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 50 })
  name: string; // INGRESADO, VISTA, EN_REVISION, etc
}
