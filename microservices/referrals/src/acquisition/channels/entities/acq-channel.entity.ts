import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum ChannelType {
  OWN = 'OWN',
  MEDIA = 'MEDIA',
  CREATOR = 'CREATOR',
  OTHER = 'OTHER',
}

@Entity('acq_channels')
export class AcqChannel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'company_id', type: 'varchar', length: 36 })
  companyId!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string; // TeamCellmania, Casho, El Heraldo

  @Column({ type: 'enum', enum: ChannelType, default: ChannelType.OTHER })
  type!: ChannelType;

  @Column({ default: true })
  active!: boolean;
}