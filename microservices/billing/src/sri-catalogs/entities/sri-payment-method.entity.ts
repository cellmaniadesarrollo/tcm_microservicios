import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('sri_payment_methods')
export class SriPaymentMethod {
  @PrimaryColumn({ type: 'varchar', length: 2 })
  code: string; // formaPago en el XML: 01, 15, 16, ...

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ default: true })
  active: boolean;
}