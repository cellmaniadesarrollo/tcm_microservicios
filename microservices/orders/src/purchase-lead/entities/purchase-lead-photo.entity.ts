import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('purchase_lead_photos')
export class PurchaseLeadPhoto {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'int' })
  lead_id!: number;

  @Column({ type: 'varchar', length: 500 })
  file_key!: string;

  @Column({ type: 'varchar', length: 255 })
  file_name!: string;

  @Column({ type: 'varchar', length: 100 })
  file_type!: string;

  @Column({ type: 'varchar', nullable: true })
  uploaded_by_id!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}