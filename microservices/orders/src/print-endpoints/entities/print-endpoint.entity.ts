import { Column, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity('print_endpoints')
@Unique(['companyId', 'codeEstablecimiento'])
export class PrintEndpoint {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id', type: 'varchar' })
  companyId: string;

  @Column({ name: 'code_establecimiento', type: 'varchar', length: 3 })
  codeEstablecimiento: string;

  @Column({ type: 'varchar' })
  url: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}