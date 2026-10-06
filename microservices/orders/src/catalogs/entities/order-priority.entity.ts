import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('order_priorities')
export class OrderPriority {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true })
  name: string; // PREMIUM, BAJA, MEDIA, ALTA, CRITICA

  /** Recargo en % sobre el total de la orden (ej. 15.00). 0 = sin recargo */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  surcharge_percentage: number;
}