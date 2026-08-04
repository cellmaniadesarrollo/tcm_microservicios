import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'; 

@Entity('order_priorities')
export class OrderPriority {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true })
  name: string; // BAJA, MEDIA, ALTA, CRÍTICA
 
}
