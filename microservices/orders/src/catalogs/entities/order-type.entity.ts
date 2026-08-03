import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm'; 

@Entity('order_types')
export class OrderType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, unique: true })
  name: string; // SERVICIO TÉCNICO, PERSONALIZADO, PARA REPUESTOS
 
}
