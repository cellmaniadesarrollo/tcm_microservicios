import {
  Entity,
  Column,
  ManyToOne,
  PrimaryColumn,
  Index,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';

@Entity('company_users')
@Index(['company' ])
@Index(['updatedAt']) // 🔥 clave para replay
export class CompanyUser {
  /**
   * 🆔 ID REAL DEL USUARIO (ms-users)
   */
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  /**
   * 👤 Nombre de usuario (replicado)
   */
  @Column()
  name_user: string;

 
  /**
   * 🏢 Compañía
   */
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  company: Company;

  /**
   * ⏱️ Timestamps ORIGINALES (ms-users)
   */
  @Column({ type: 'timestamp', nullable: true })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  updatedAt: Date;
}
