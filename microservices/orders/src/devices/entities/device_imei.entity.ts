import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Device } from './device.entity';
import { CompanyReplica } from '../../companies/entities/company-replica.entity';

@Entity('device_imeis')
@Unique(['company_id', 'imei_number']) // 🔐 IMEI único por empresa
export class DeviceIMEI {
  @PrimaryGeneratedColumn()
  imei_id: number;

  @Column({ length: 50 })
  imei_number: string;

  @Column({ type: 'uuid' })
  company_id: string;

  @ManyToOne(() => CompanyReplica)
  @JoinColumn({ name: 'company_id' })
  company: CompanyReplica;

  @ManyToOne(() => Device, (device) => device.imeis, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;
}