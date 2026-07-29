// companies/entities/branch.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';

@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  address: string;

  @Column({ nullable: true })
  reference: string;

  @Column()
  phone: string;

  @Column()
  code: string;

   /**
   * ⚠️ REQUIERE POSTGIS
   *
   * Esta columna usa el tipo `geography(Point, 4326)`,
   * por lo que es OBLIGATORIO tener la extensión PostGIS instalada
   * tanto en DESARROLLO como en PRODUCCIÓN.
   */
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  @Index({ spatial: true })
  location: string;

  @Column({ default: true })
  status: boolean;

  @ManyToOne(() => Company, company => company.branches, {
    onDelete: 'CASCADE',
  })
  company: Company;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
