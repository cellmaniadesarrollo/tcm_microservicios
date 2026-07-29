import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { CompanyReplica } from './company-replica.entity';

@Entity('branches_replica')
export class BranchReplica {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  address: string;
 

  @Column()
  code: string;

@Column({
  type: 'geography',
  spatialFeatureType: 'Point',
  srid: 4326,
  nullable: true,
})
location?: {
  type: 'Point';
  coordinates: [number, number];
};

  @Column({ default: true })
  status: boolean;

  @ManyToOne(() => CompanyReplica, company => company.branches, {
    onDelete: 'CASCADE',
  })
  company: CompanyReplica;

 
}

